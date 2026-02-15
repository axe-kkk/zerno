from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from sqlalchemy import and_
from backend.database import get_session
from backend.models import (
    GrainVoucher, GrainVoucherPayment, CashRegister, Transaction,
    TransactionType, Currency, GrainOwner, GrainCulture, FarmerContract,
    FarmerContractPayment
)
from backend.auth import get_current_user, User
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()


# ── Schemas ──

class VoucherPaymentCreate(BaseModel):
    currency: str = "UAH"
    amount: float
    exchange_rate: float = 1.0
    description: Optional[str] = None


class VoucherPaymentCancelRequest(BaseModel):
    pass


# ── Helpers ──

def get_or_create_cash_register(session: Session) -> CashRegister:
    cash_register = session.exec(select(CashRegister)).first()
    if not cash_register:
        cash_register = CashRegister(uah_balance=0.0, usd_balance=0.0, eur_balance=0.0)
        session.add(cash_register)
        session.commit()
        session.refresh(cash_register)
    return cash_register


# ── Endpoints ──

@router.get("")
async def list_vouchers(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Список всіх талонів на зерно"""
    vouchers = session.exec(
        select(GrainVoucher).order_by(GrainVoucher.created_at.desc())
    ).all()

    result = []
    for v in vouchers:
        owner = session.get(GrainOwner, v.owner_id)
        culture = session.get(GrainCulture, v.culture_id)
        contract = session.get(FarmerContract, v.farmer_contract_id)

        result.append({
            "id": v.id,
            "farmer_contract_id": v.farmer_contract_id,
            "farmer_contract_payment_id": v.farmer_contract_payment_id,
            "owner_id": v.owner_id,
            "owner_name": owner.full_name if owner else "—",
            "culture_id": v.culture_id,
            "culture_name": culture.name if culture else "—",
            "quantity_kg": v.quantity_kg,
            "price_per_kg": v.price_per_kg,
            "total_value_uah": v.total_value_uah,
            "is_closed": v.is_closed,
            "note": v.note,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        })

    return result


@router.get("/summary")
async def vouchers_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Зведена статистика по талонах"""
    vouchers = session.exec(select(GrainVoucher)).all()
    payments = session.exec(
        select(GrainVoucherPayment).where(GrainVoucherPayment.is_cancelled == False)
    ).all()

    total_quantity_kg = sum(v.quantity_kg for v in vouchers)
    total_debt_uah = sum(v.total_value_uah for v in vouchers)
    total_paid_uah = sum(p.amount_uah for p in payments)
    total_remaining_uah = max(0.0, total_debt_uah - total_paid_uah)
    vouchers_count = len(vouchers)

    return {
        "vouchers_count": vouchers_count,
        "total_quantity_kg": round(total_quantity_kg, 2),
        "total_debt_uah": round(total_debt_uah, 2),
        "total_paid_uah": round(total_paid_uah, 2),
        "total_remaining_uah": round(total_remaining_uah, 2),
    }


@router.get("/payments")
async def list_voucher_payments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Список всіх виплат по талонах"""
    payments = session.exec(
        select(GrainVoucherPayment).order_by(GrainVoucherPayment.created_at.desc())
    ).all()

    result = []
    for p in payments:
        user = session.get(User, p.created_by_user_id) if p.created_by_user_id else None

        result.append({
            "id": p.id,
            "voucher_id": p.voucher_id,
            "currency": p.currency.value if isinstance(p.currency, Currency) else p.currency,
            "amount": p.amount,
            "exchange_rate": p.exchange_rate,
            "amount_uah": p.amount_uah,
            "description": p.description,
            "is_cancelled": p.is_cancelled,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "created_by": user.full_name if user else "—",
        })

    return result


@router.post("/payments")
async def create_voucher_payment(
    data: VoucherPaymentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Створити виплату по загальному боргу талонів (зняти гроші з каси)"""

    # Calculate total remaining debt
    vouchers = session.exec(select(GrainVoucher)).all()
    all_payments = session.exec(
        select(GrainVoucherPayment).where(GrainVoucherPayment.is_cancelled == False)
    ).all()

    total_debt_uah = sum(v.total_value_uah for v in vouchers)
    total_paid_uah = sum(p.amount_uah for p in all_payments)
    total_remaining_uah = max(0.0, total_debt_uah - total_paid_uah)

    # Calculate payment in UAH
    amount_uah = round(data.amount * data.exchange_rate, 2)
    if amount_uah <= 0:
        raise HTTPException(status_code=400, detail="Сума повинна бути більше 0")
    if amount_uah > total_remaining_uah + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Сума перевищує загальний залишок боргу ({total_remaining_uah:.2f} грн)"
        )

    # Deduct from cash register
    cash = get_or_create_cash_register(session)
    currency_enum = Currency(data.currency)

    if currency_enum == Currency.UAH:
        if cash.uah_balance < data.amount - 0.01:
            raise HTTPException(status_code=400, detail="Недостатньо коштів у касі (UAH)")
        cash.uah_balance -= data.amount
    elif currency_enum == Currency.USD:
        if cash.usd_balance < data.amount - 0.01:
            raise HTTPException(status_code=400, detail="Недостатньо коштів у касі (USD)")
        cash.usd_balance -= data.amount
    elif currency_enum == Currency.EUR:
        if cash.eur_balance < data.amount - 0.01:
            raise HTTPException(status_code=400, detail="Недостатньо коштів у касі (EUR)")
        cash.eur_balance -= data.amount

    session.add(cash)

    # Cash transaction record
    tx_description = f"Виплата по талонах на зерно"
    if data.description:
        tx_description += f" — {data.description}"

    transaction = Transaction(
        currency=currency_enum,
        amount=data.amount,
        transaction_type=TransactionType.SUBTRACT,
        user_id=current_user.id,
        description=tx_description,
        uah_balance_after=round(cash.uah_balance, 2),
        usd_balance_after=round(cash.usd_balance, 2),
        eur_balance_after=round(cash.eur_balance, 2),
    )
    session.add(transaction)

    # Create payment record (not tied to specific voucher — use first open voucher as reference)
    open_vouchers = [v for v in vouchers if not v.is_closed]
    ref_voucher_id = open_vouchers[0].id if open_vouchers else (vouchers[0].id if vouchers else None)

    payment = GrainVoucherPayment(
        voucher_id=ref_voucher_id,
        currency=currency_enum,
        amount=data.amount,
        exchange_rate=data.exchange_rate,
        amount_uah=amount_uah,
        description=data.description,
        created_by_user_id=current_user.id,
    )
    session.add(payment)

    # Auto-close vouchers that are fully paid (FIFO)
    remaining_to_distribute = total_paid_uah + amount_uah
    for v in sorted(vouchers, key=lambda x: x.created_at or datetime.min):
        if remaining_to_distribute >= v.total_value_uah - 0.01:
            v.paid_value_uah = v.total_value_uah
            v.remaining_value_uah = 0.0
            v.is_closed = True
            remaining_to_distribute -= v.total_value_uah
        else:
            v.paid_value_uah = remaining_to_distribute
            v.remaining_value_uah = round(v.total_value_uah - remaining_to_distribute, 2)
            v.is_closed = False
            remaining_to_distribute = 0
        session.add(v)

    session.commit()
    return {"ok": True, "message": "Виплату створено"}


@router.post("/payments/{payment_id}/cancel")
async def cancel_voucher_payment(
    payment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Скасувати виплату (повернути гроші в касу)"""
    payment = session.get(GrainVoucherPayment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Виплату не знайдено")
    if payment.is_cancelled:
        raise HTTPException(status_code=400, detail="Виплату вже скасовано")

    # Return money to cash register
    cash = get_or_create_cash_register(session)
    currency_enum = payment.currency if isinstance(payment.currency, Currency) else Currency(payment.currency)

    if currency_enum == Currency.UAH:
        cash.uah_balance += payment.amount
    elif currency_enum == Currency.USD:
        cash.usd_balance += payment.amount
    elif currency_enum == Currency.EUR:
        cash.eur_balance += payment.amount

    session.add(cash)

    # Cash transaction record
    transaction = Transaction(
        currency=currency_enum,
        amount=payment.amount,
        transaction_type=TransactionType.ADD,
        user_id=current_user.id,
        description=f"Повернення виплати по талонах (#{payment.id})",
        uah_balance_after=round(cash.uah_balance, 2),
        usd_balance_after=round(cash.usd_balance, 2),
        eur_balance_after=round(cash.eur_balance, 2),
    )
    session.add(transaction)

    # Cancel payment
    payment.is_cancelled = True
    session.add(payment)

    # Recalculate voucher statuses (FIFO)
    vouchers = session.exec(select(GrainVoucher)).all()
    all_payments = session.exec(
        select(GrainVoucherPayment).where(GrainVoucherPayment.is_cancelled == False)
    ).all()
    total_paid = sum(p.amount_uah for p in all_payments)

    remaining_to_distribute = total_paid
    for v in sorted(vouchers, key=lambda x: x.created_at or datetime.min):
        if remaining_to_distribute >= v.total_value_uah - 0.01:
            v.paid_value_uah = v.total_value_uah
            v.remaining_value_uah = 0.0
            v.is_closed = True
            remaining_to_distribute -= v.total_value_uah
        else:
            v.paid_value_uah = max(0.0, remaining_to_distribute)
            v.remaining_value_uah = round(v.total_value_uah - v.paid_value_uah, 2)
            v.is_closed = False
            remaining_to_distribute = 0
        session.add(v)

    session.commit()
    return {"ok": True, "message": "Виплату скасовано, кошти повернуто"}
