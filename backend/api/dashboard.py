from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from sqlalchemy import and_
from backend.database import get_session
from backend.models import (
    CashRegister, GrainStock, GrainCulture, GrainIntake, GrainShipment,
    FarmerContract, FarmerContractStatus, GrainOwner, Transaction,
    PurchaseStock, PurchaseCategory
)
from backend.auth import get_current_user, User
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

router = APIRouter()


class DashboardStatsResponse(BaseModel):
    """Статистика для дашборда"""
    # Каса
    cash_balances: dict[str, float]  # {"uah": 0.0, "usd": 0.0, "eur": 0.0}
    
    # Склад
    total_stock_kg: float  # Общее количество зерна на складе
    stock_by_culture: list[dict]  # [{"name": "Пшениця", "quantity_kg": 1000.0}, ...]
    top_cultures: list[dict]  # Топ-5 культур по количеству
    total_own_kg: float  # Выкупленное зерно
    total_farmer_kg: float  # Невыкупленное зерно
    
    # Контракти фермерів
    contracts_total: int
    contracts_open: int
    contracts_closed: int
    contracts_total_value: float  # Общая сумма всех контрактов
    contracts_balance: float  # Общий остаток по контрактам
    avg_contract_value: float  # Средняя сумма контракта
    
    # Фермери
    farmers_total: int
    farmers_active: int  # С активными контрактами
    
    # Операції
    intakes_today: int
    intakes_pending: int  # Ожидают подтверждения
    shipments_today: int
    total_intakes: int  # Всего приёмов
    total_shipments: int  # Всего отправок
    total_intake_kg: float  # Всего принято зерна, кг
    total_shipment_kg: float  # Всего отправлено зерна, кг
    
    # Последние транзакции кассы
    recent_transactions: list[dict]
    
    # Закупки
    purchases_stock_total: float  # Общее количество закупок на складе
    purchases_by_category: list[dict]  # По категориям


def get_or_create_cash_register(session: Session) -> CashRegister:
    """Получение или создание кассы"""
    cash_register = session.exec(select(CashRegister)).first()
    if not cash_register:
        cash_register = CashRegister(
            uah_balance=0.0,
            usd_balance=0.0,
            eur_balance=0.0
        )
        session.add(cash_register)
        session.commit()
        session.refresh(cash_register)
    return cash_register


@router.get("/stats")
async def get_dashboard_stats(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Получение статистики для дашборда"""
    
    # ── Каса ──
    cash_register = get_or_create_cash_register(session)
    cash_balances = {
        "uah": round(cash_register.uah_balance, 2),
        "usd": round(cash_register.usd_balance, 2),
        "eur": round(cash_register.eur_balance, 2)
    }
    
    # ── Склад ──
    stocks = session.exec(select(GrainStock)).all()
    total_stock_kg = sum(s.quantity_kg for s in stocks)
    total_own_kg = sum(s.own_quantity_kg for s in stocks)  # Выкупленное зерно
    total_farmer_kg = sum(s.farmer_quantity_kg for s in stocks)  # Невыкупленное зерно
    
    stock_by_culture = []
    for stock in stocks:
        culture = session.get(GrainCulture, stock.culture_id)
        if culture and stock.quantity_kg > 0:
            stock_by_culture.append({
                "name": culture.name,
                "quantity_kg": round(stock.quantity_kg, 2),
                "own_quantity_kg": round(stock.own_quantity_kg, 2),
                "farmer_quantity_kg": round(stock.farmer_quantity_kg, 2)
            })
    
    # Сортируем по количеству и берем топ-5
    top_cultures = sorted(stock_by_culture, key=lambda x: x["quantity_kg"], reverse=True)[:5]
    
    # ── Общая статистика по приёмам и отправкам ──
    total_intakes = session.exec(select(func.count(GrainIntake.id))).one() or 0
    total_shipments = session.exec(select(func.count(GrainShipment.id))).one() or 0
    
    # Общее количество принятого зерна
    total_intake_kg = session.exec(
        select(func.sum(GrainIntake.accepted_weight_kg))
    ).one() or 0.0
    total_intake_kg = round(total_intake_kg, 2) if total_intake_kg else 0.0
    
    # Общее количество отправленного зерна
    total_shipment_kg = session.exec(
        select(func.sum(GrainShipment.quantity_kg))
    ).one() or 0.0
    total_shipment_kg = round(total_shipment_kg, 2) if total_shipment_kg else 0.0
    
    # Средняя сумма контракта
    avg_contract_value = round(contracts_total_value / contracts_total, 2) if contracts_total > 0 else 0.0
    
    # ── Контракти фермерів ──
    all_contracts = session.exec(select(FarmerContract)).all()
    contracts_total = len(all_contracts)
    contracts_open = sum(1 for c in all_contracts if c.status == FarmerContractStatus.OPEN)
    contracts_closed = sum(1 for c in all_contracts if c.status == FarmerContractStatus.CLOSED)
    contracts_total_value = sum(c.total_value_uah for c in all_contracts)
    contracts_balance = sum(c.balance_uah for c in all_contracts)
    
    # ── Фермери ──
    all_farmers = session.exec(select(GrainOwner)).all()
    farmers_total = len(all_farmers)
    
    # Фермеры с активными (открытыми) контрактами
    active_farmer_ids = {c.owner_id for c in all_contracts if c.status == FarmerContractStatus.OPEN}
    farmers_active = len(active_farmer_ids)
    
    # ── Операції (сегодня) ──
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    intakes_today = session.exec(
        select(func.count(GrainIntake.id))
        .where(and_(
            GrainIntake.created_at >= today_start,
            GrainIntake.created_at < today_end
        ))
    ).one() or 0
    
    intakes_pending = session.exec(
        select(func.count(GrainIntake.id))
        .where(GrainIntake.pending_quality == True)
    ).one() or 0
    
    shipments_today = session.exec(
        select(func.count(GrainShipment.id))
        .where(and_(
            GrainShipment.created_at >= today_start,
            GrainShipment.created_at < today_end
        ))
    ).one() or 0
    
    # ── Последние транзакции кассы ──
    recent_trans = session.exec(
        select(Transaction)
        .order_by(Transaction.created_at.desc())
        .limit(5)
    ).all()
    
    recent_transactions = []
    for t in recent_trans:
        recent_transactions.append({
            "id": t.id,
            "currency": t.currency.value,
            "amount": round(t.amount, 2),
            "type": t.transaction_type.value,
            "description": t.description or "",
            "created_at": t.created_at.isoformat() if t.created_at else None
        })
    
    # ── Закупки ──
    purchases_stock = session.exec(select(PurchaseStock)).all()
    purchases_stock_total = sum(p.quantity_kg for p in purchases_stock)
    
    # По категориям
    purchases_by_category = {}
    for p in purchases_stock:
        cat_name = p.category.value if p.category else "Інше"
        if cat_name not in purchases_by_category:
            purchases_by_category[cat_name] = 0.0
        purchases_by_category[cat_name] += p.quantity_kg
    
    purchases_by_category_list = [
        {"category": k, "quantity_kg": round(v, 2)}
        for k, v in sorted(purchases_by_category.items(), key=lambda x: x[1], reverse=True)
    ]
    
    return DashboardStatsResponse(
        cash_balances=cash_balances,
        total_stock_kg=round(total_stock_kg, 2),
        stock_by_culture=stock_by_culture,
        top_cultures=top_cultures,
        contracts_total=contracts_total,
        contracts_open=contracts_open,
        contracts_closed=contracts_closed,
        contracts_total_value=round(contracts_total_value, 2),
        contracts_balance=round(contracts_balance, 2),
        farmers_total=farmers_total,
        farmers_active=farmers_active,
        intakes_today=intakes_today,
        intakes_pending=intakes_pending,
        shipments_today=shipments_today,
        recent_transactions=recent_transactions,
        purchases_stock_total=round(purchases_stock_total, 2),
        purchases_by_category=purchases_by_category_list,
        total_own_kg=round(total_own_kg, 2),
        total_farmer_kg=round(total_farmer_kg, 2),
        total_intakes=total_intakes,
        total_shipments=total_shipments,
        total_intake_kg=total_intake_kg,
        total_shipment_kg=total_shipment_kg,
        avg_contract_value=avg_contract_value
    )

