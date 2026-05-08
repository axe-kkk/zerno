from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse, Response
from sqlmodel import Session, select
from typing import Optional
from datetime import datetime, date, time as dtime
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from backend.database import get_session
from backend.models import (
    Landlord,
    LeaseContract,
    LeaseContractItem,
    LeasePayment,
    LeasePaymentGrainItem,
    GrainCulture,
    GrainStock,
    CashRegister,
    Transaction,
    StockAdjustmentLog,
    StockAdjustmentType,
    Currency,
    TransactionType,
    AgriField,
    User
)
from backend.schemas import (
    LandlordCreate,
    LandlordResponse,
    LandlordUpdate,
    LeaseContractCreate,
    LeaseContractResponse,
    LeaseContractUpdate,
    LeaseContractItemCreate,
    LeaseContractItemResponse,
    LeaseContractRenewRequest,
    LeasePaymentCreate,
    LeasePaymentResponse,
    LeasePaymentGrainItemResponse
)
from backend.auth import get_current_user, get_current_super_admin

router = APIRouter()


# ===== Helpers =====

def add_one_year(dt):
    """Додати 1 рік до дати"""
    d = dt.date() if isinstance(dt, datetime) else dt
    try:
        return d.replace(year=d.year + 1)
    except ValueError:
        return d.replace(year=d.year + 1, day=28)


def is_contract_expired(contract):
    """Чи завершився контракт"""
    if not contract.end_date:
        return False
    end = contract.end_date.date() if isinstance(contract.end_date, datetime) else contract.end_date
    return date.today() >= end


def get_current_lease_period(contract_date):
    """Визначити поточний орендний рік за датою контракту"""
    today = date.today()
    cd = contract_date.date() if isinstance(contract_date, datetime) else contract_date

    years = today.year - cd.year
    if (today.month, today.day) < (cd.month, cd.day):
        years -= 1
    if years < 0:
        years = 0

    try:
        period_start = cd.replace(year=cd.year + years)
    except ValueError:
        period_start = cd.replace(year=cd.year + years, day=28)
    try:
        period_end = cd.replace(year=cd.year + years + 1)
    except ValueError:
        period_end = cd.replace(year=cd.year + years + 1, day=28)

    return period_start, period_end, years + 1


def get_paid_per_culture(contract_id: int, period_start: date, period_end: date, session: Session) -> dict:
    """Порахувати скільки вже виплачено за кожною культурою (без скасованих).

    Параметри period_start / period_end залишені для сумісності викликів, але
    фільтрацію по датах не застосовуємо: один lease_contracts.id — один зобов'язання
    по позиціях, виплати після end_date (погашення заборгованості) теж мають
    зменшувати залишок. Раніше умова payment_date < period_end відсікала такі
    виплати, і баланс / «закритість» контракту не оновлювались після виплати зерном.
    """
    payments = session.exec(
        select(LeasePayment).where(
            LeasePayment.contract_id == contract_id,
            LeasePayment.is_cancelled == False
        )
    ).all()

    paid = {}
    for payment in payments:
        grain_items = session.exec(
            select(LeasePaymentGrainItem).where(
                LeasePaymentGrainItem.payment_id == payment.id
            )
        ).all()
        for item in grain_items:
            paid[item.culture_id] = paid.get(item.culture_id, 0) + item.quantity_kg

    return paid


def build_lease_contract_response(session: Session, contract: LeaseContract) -> LeaseContractResponse:
    """Зібрати LeaseContractResponse з позиціями та залишком до виплати (як у списку)."""
    contract_items = session.exec(
        select(LeaseContractItem).where(
            LeaseContractItem.contract_id == contract.id
        )
    ).all()
    items_list = []
    for item in contract_items:
        culture = session.get(GrainCulture, item.culture_id)
        item_dict = item.model_dump()
        item_dict["culture_name"] = culture.name if culture else None
        items_list.append(LeaseContractItemResponse(**item_dict))

    cd = contract.contract_date
    period_start = cd.date() if isinstance(cd, datetime) else cd
    if contract.end_date:
        ed = contract.end_date
        period_end = ed.date() if isinstance(ed, datetime) else ed
    else:
        period_end = add_one_year(period_start)

    paid_per_culture = get_paid_per_culture(contract.id, period_start, period_end, session)
    remaining_cash_uah = 0.0
    for ci in contract_items:
        paid = float(paid_per_culture.get(ci.culture_id, 0) or 0)
        remaining_kg = max(0.0, float(ci.quantity_kg or 0) - paid)
        remaining_cash_uah += remaining_kg * float(ci.price_per_kg_uah or 0)
    remaining_cash_uah = round(remaining_cash_uah, 2)

    expired = is_contract_expired(contract)
    contract_dict = contract.model_dump()
    contract_dict["contract_items"] = items_list
    contract_dict["is_expired"] = expired
    contract_dict["remaining_cash_uah"] = remaining_cash_uah
    contract_dict["has_debt"] = remaining_cash_uah > 0.01
    contract_dict["is_overdue"] = expired and remaining_cash_uah > 0.01
    return LeaseContractResponse(**contract_dict)


@router.get("/landlords", response_model=list[LandlordResponse])
async def list_landlords(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    q: Optional[str] = Query(None, description="Пошук за ПІБ")
):
    """Список орендодавців (пошук для автодоповнення)"""
    query = select(Landlord)
    if q:
        query = query.where(Landlord.full_name.ilike(f"%{q}%"))
    return session.exec(query.order_by(Landlord.full_name)).all()


@router.post("/landlords", response_model=LandlordResponse)
async def create_landlord(
    payload: LandlordCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Створення орендодавця"""
    cleaned_name = " ".join(payload.full_name.split()).strip()
    if not cleaned_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Вкажіть ПІБ орендодавця"
        )
    
    landlord = Landlord(
        full_name=cleaned_name,
        phone=payload.phone.strip() if payload.phone else None
    )
    session.add(landlord)
    session.commit()
    session.refresh(landlord)
    return landlord


@router.patch("/landlords/{landlord_id}", response_model=LandlordResponse)
async def update_landlord(
    landlord_id: int,
    payload: LandlordUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Оновлення орендодавця"""
    landlord = session.get(Landlord, landlord_id)
    if not landlord:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Орендодавця не знайдено"
        )
    
    if payload.full_name is not None:
        cleaned_name = " ".join(payload.full_name.split()).strip()
        if not cleaned_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Вкажіть ПІБ орендодавця"
            )
        landlord.full_name = cleaned_name
    
    if payload.phone is not None:
        landlord.phone = payload.phone.strip() if payload.phone else None
    
    landlord.updated_at = datetime.utcnow()
    session.add(landlord)
    session.commit()
    session.refresh(landlord)
    return landlord


@router.delete("/landlords/{landlord_id}", response_model=LandlordResponse)
async def delete_landlord(
    landlord_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_super_admin)
):
    """Видалення орендодавця"""
    landlord = session.get(Landlord, landlord_id)
    if not landlord:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Орендодавця не знайдено"
        )
    
    # Проверяем, есть ли активные контракты
    active_contracts = session.exec(
        select(LeaseContract).where(
            LeaseContract.landlord_id == landlord_id,
            LeaseContract.is_active == True
        )
    ).first()
    
    if active_contracts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неможливо видалити орендодавця з активними контрактами"
        )
    
    session.delete(landlord)
    session.commit()
    return landlord


@router.get("/contracts", response_model=list[LeaseContractResponse])
async def list_contracts(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    landlord_id: Optional[int] = Query(None, description="Фільтр за орендодавцем"),
    is_active: Optional[bool] = Query(None, description="Фільтр за активністю"),
    due_only: Optional[bool] = Query(None, description="Показати лише контракти з залишком до виплати")
):
    """Список контрактів оренди"""
    query = select(LeaseContract)
    if landlord_id:
        query = query.where(LeaseContract.landlord_id == landlord_id)
    if is_active is not None:
        query = query.where(LeaseContract.is_active == is_active)
    
    contracts = session.exec(query.order_by(LeaseContract.contract_date.desc())).all()
    
    result = []
    for contract in contracts:
        row = build_lease_contract_response(session, contract)
        if due_only and row.remaining_cash_uah <= 0.01:
            continue
        result.append(row)

    return result


@router.post("/contracts", response_model=LeaseContractResponse)
async def create_contract(
    payload: LeaseContractCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_super_admin)
):
    """Створення контракту оренди"""
    landlord = session.get(Landlord, payload.landlord_id)
    if not landlord:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Орендодавця не знайдено"
        )
    
    if not payload.contract_items or len(payload.contract_items) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Додайте хоча б одну позицію контракту"
        )
    
    field_name = " ".join(payload.field_name.split()).strip()
    if not field_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Вкажіть назву поля"
        )
    
    # Проверяем все культуры
    for item in payload.contract_items:
        culture = session.get(GrainCulture, item.culture_id)
        if not culture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Культуру з ID {item.culture_id} не знайдено"
            )
    
    end = add_one_year(payload.contract_date)
    contract = LeaseContract(
        landlord_id=payload.landlord_id,
        landlord_full_name=landlord.full_name,
        field_name=field_name,
        contract_date=payload.contract_date,
        end_date=datetime.combine(end, dtime.min),
        is_active=payload.is_active,
        note=payload.note
    )
    session.add(contract)
    session.flush()

    existing_field = session.exec(
        select(AgriField).where(
            AgriField.name == field_name,
            AgriField.landlord_id == payload.landlord_id
        )
    ).first()
    if not existing_field:
        agri_field = AgriField(
            name=field_name,
            owner_name=landlord.full_name,
            landlord_id=payload.landlord_id,
            lease_contract_id=contract.id
        )
        session.add(agri_field)
    else:
        existing_field.lease_contract_id = contract.id
        session.add(existing_field)

    # Создаем позиции контракта
    for item in payload.contract_items:
        contract_item = LeaseContractItem(
            contract_id=contract.id,
            culture_id=item.culture_id,
            quantity_kg=item.quantity_kg,
            price_per_kg_uah=item.price_per_kg_uah
        )
        session.add(contract_item)
    
    session.commit()
    session.refresh(contract)
    
    # Загружаем позиции для ответа
    contract_items = session.exec(
        select(LeaseContractItem).where(
            LeaseContractItem.contract_id == contract.id
        )
    ).all()
    items_list = []
    for item in contract_items:
        culture = session.get(GrainCulture, item.culture_id)
        item_dict = item.model_dump()
        item_dict["culture_name"] = culture.name if culture else None
        items_list.append(LeaseContractItemResponse(**item_dict))
    
    contract_dict = contract.model_dump()
    contract_dict["contract_items"] = items_list
    contract_dict["is_expired"] = is_contract_expired(contract)
    return LeaseContractResponse(**contract_dict)


@router.patch("/contracts/{contract_id}", response_model=LeaseContractResponse)
async def update_contract(
    contract_id: int,
    payload: LeaseContractUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_super_admin)
):
    """Оновлення контракту оренди"""
    contract = session.get(LeaseContract, contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контракт не знайдено"
        )
    
    update_data = payload.model_dump(exclude_unset=True)
    contract_items_payload = update_data.pop("contract_items", None)

    if "landlord_id" in update_data:
        landlord = session.get(Landlord, update_data["landlord_id"])
        if not landlord:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Орендодавця не знайдено"
            )
        update_data["landlord_full_name"] = landlord.full_name

    if "field_name" in update_data:
        field_name = " ".join(update_data["field_name"].split()).strip()
        if not field_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Вкажіть назву поля"
            )
        update_data["field_name"] = field_name
    
    for field, value in update_data.items():
        setattr(contract, field, value)

    if contract_items_payload is not None:
        if len(contract_items_payload) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Додайте хоча б одну позицію контракту"
            )
        for row in contract_items_payload:
            cid = row.get("culture_id") if isinstance(row, dict) else getattr(row, "culture_id", None)
            culture = session.get(GrainCulture, cid)
            if not culture:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Культуру з ID {cid} не знайдено"
                )
        for old in session.exec(
            select(LeaseContractItem).where(
                LeaseContractItem.contract_id == contract_id
            )
        ).all():
            session.delete(old)
        session.flush()
        for row in contract_items_payload:
            if isinstance(row, dict):
                cid = row["culture_id"]
                q = row["quantity_kg"]
                p = row["price_per_kg_uah"]
            else:
                cid = row.culture_id
                q = row.quantity_kg
                p = row.price_per_kg_uah
            session.add(
                LeaseContractItem(
                    contract_id=contract.id,
                    culture_id=cid,
                    quantity_kg=q,
                    price_per_kg_uah=p,
                )
            )

    contract.updated_at = datetime.utcnow()
    session.add(contract)
    session.commit()
    session.refresh(contract)

    return build_lease_contract_response(session, contract)


@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract(
    contract_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_super_admin)
):
    """Видалення контракту оренди (з позиціями, виплатами та прив'язкою поля)."""
    contract = session.get(LeaseContract, contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контракт не знайдено"
        )

    payments = session.exec(
        select(LeasePayment).where(LeasePayment.contract_id == contract_id)
    ).all()
    for payment in payments:
        grain_rows = session.exec(
            select(LeasePaymentGrainItem).where(
                LeasePaymentGrainItem.payment_id == payment.id
            )
        ).all()
        for gi in grain_rows:
            session.delete(gi)
        session.delete(payment)

    items = session.exec(
        select(LeaseContractItem).where(
            LeaseContractItem.contract_id == contract_id
        )
    ).all()
    for ci in items:
        session.delete(ci)

    for field in session.exec(
        select(AgriField).where(AgriField.lease_contract_id == contract_id)
    ).all():
        field.lease_contract_id = None
        session.add(field)

    for child in session.exec(
        select(LeaseContract).where(
            LeaseContract.parent_contract_id == contract_id
        )
    ).all():
        child.parent_contract_id = None
        session.add(child)

    session.delete(contract)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/contracts/{contract_id}/renew", response_model=LeaseContractResponse)
async def renew_contract(
    contract_id: int,
    payload: LeaseContractRenewRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_super_admin)
):
    """Перевипуск контракту оренди на новий рік"""
    old_contract = session.get(LeaseContract, contract_id)
    if not old_contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контракт не знайдено"
        )

    landlord = session.get(Landlord, old_contract.landlord_id)
    if not landlord:
        raise HTTPException(status_code=404, detail="Орендодавця не знайдено")

    if not old_contract.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Контракт не активний — перевипуск недоступний"
        )

    if old_contract.end_date:
        end = (
            old_contract.end_date.date()
            if isinstance(old_contract.end_date, datetime)
            else old_contract.end_date
        )
        if date.today() <= end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Перевипуск можливий лише після закінчення строку дії контракту",
            )

    for item in payload.contract_items:
        culture = session.get(GrainCulture, item.culture_id)
        if not culture:
            raise HTTPException(status_code=404, detail=f"Культуру з ID {item.culture_id} не знайдено")

    old_contract.is_active = False
    old_contract.updated_at = datetime.utcnow()
    session.add(old_contract)

    end = add_one_year(payload.contract_date)
    new_contract = LeaseContract(
        landlord_id=old_contract.landlord_id,
        landlord_full_name=landlord.full_name,
        field_name=old_contract.field_name,
        contract_date=payload.contract_date,
        end_date=datetime.combine(end, dtime.min),
        parent_contract_id=old_contract.id,
        is_active=True,
        note=payload.note
    )
    session.add(new_contract)
    session.flush()

    agri_field = session.exec(
        select(AgriField).where(AgriField.lease_contract_id == old_contract.id)
    ).first()
    if agri_field:
        agri_field.lease_contract_id = new_contract.id
        session.add(agri_field)

    for item in payload.contract_items:
        session.add(LeaseContractItem(
            contract_id=new_contract.id,
            culture_id=item.culture_id,
            quantity_kg=item.quantity_kg,
            price_per_kg_uah=item.price_per_kg_uah
        ))

    session.commit()
    session.refresh(new_contract)

    items = session.exec(
        select(LeaseContractItem).where(LeaseContractItem.contract_id == new_contract.id)
    ).all()
    items_list = []
    for item in items:
        culture = session.get(GrainCulture, item.culture_id)
        item_dict = item.model_dump()
        item_dict["culture_name"] = culture.name if culture else None
        items_list.append(LeaseContractItemResponse(**item_dict))

    contract_dict = new_contract.model_dump()
    contract_dict["contract_items"] = items_list
    contract_dict["is_expired"] = False
    return LeaseContractResponse(**contract_dict)


@router.get("/contracts/{contract_id}/balance")
async def get_contract_balance(
    contract_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Залишок виплат по контракту"""
    contract = session.get(LeaseContract, contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контракт не знайдено"
        )

    cd = contract.contract_date
    period_start = cd.date() if isinstance(cd, datetime) else cd
    if contract.end_date:
        ed = contract.end_date
        period_end = ed.date() if isinstance(ed, datetime) else ed
    else:
        period_end = add_one_year(period_start)

    contract_items = session.exec(
        select(LeaseContractItem).where(
            LeaseContractItem.contract_id == contract_id
        )
    ).all()

    paid_per_culture = get_paid_per_culture(
        contract_id, period_start, period_end, session
    )

    items = []
    for ci in contract_items:
        culture = session.get(GrainCulture, ci.culture_id)
        paid = round(paid_per_culture.get(ci.culture_id, 0), 2)
        remaining = round(max(0, ci.quantity_kg - paid), 2)
        items.append({
            "culture_id": ci.culture_id,
            "culture_name": culture.name if culture else "?",
            "annual_quantity_kg": ci.quantity_kg,
            "price_per_kg_uah": ci.price_per_kg_uah,
            "paid_kg": paid,
            "remaining_kg": remaining,
            "remaining_cash_uah": round(remaining * ci.price_per_kg_uah, 2)
        })

    expired = is_contract_expired(contract)

    return {
        "contract_id": contract_id,
        "landlord_full_name": contract.landlord_full_name,
        "field_name": contract.field_name,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "is_expired": expired,
        "items": items
    }


# ===== Excel exports =====

def _excel_header_style():
    """Стилі для заголовків Excel"""
    return {
        "fill": PatternFill("solid", fgColor="1F2937"),
        "font": Font(color="FFFFFF", bold=True),
        "alignment": Alignment(horizontal="center", vertical="center"),
        "border": Border(
            left=Side(style="thin", color="E5E7EB"),
            right=Side(style="thin", color="E5E7EB"),
            top=Side(style="thin", color="E5E7EB"),
            bottom=Side(style="thin", color="E5E7EB")
        )
    }


def _apply_header(sheet, headers):
    """Застосувати стилі заголовків"""
    sheet.append(headers)
    style = _excel_header_style()
    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = style["fill"]
        cell.font = style["font"]
        cell.alignment = style["alignment"]
        cell.border = style["border"]


def _apply_body_style(sheet, num_cols):
    """Застосувати зебру-стилі до тіла"""
    alt_fill = PatternFill("solid", fgColor="F8FAFC")
    thin_border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB")
    )
    for row in range(2, sheet.max_row + 1):
        row_fill = alt_fill if row % 2 == 0 else None
        for col in range(1, num_cols + 1):
            cell = sheet.cell(row=row, column=col)
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border


def _to_response(workbook, filename):
    """Перетворити workbook у StreamingResponse"""
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/landlords/export")
async def export_landlords(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    search: str | None = None
):
    """Експорт орендодавців у Excel"""
    query = select(Landlord).order_by(Landlord.full_name)
    if search:
        query = query.where(Landlord.full_name.ilike(f"%{search}%"))
    landlords = session.exec(query).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Орендодавці"
    headers = ["ПІБ", "Телефон", "Дата додавання"]
    _apply_header(ws, headers)

    for l in landlords:
        ws.append([
            l.full_name,
            l.phone or "-",
            l.created_at.strftime("%d.%m.%Y") if l.created_at else "-"
        ])

    _apply_body_style(ws, len(headers))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:C{ws.max_row}"
    ws.column_dimensions["A"].width = 35
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 16

    return _to_response(wb, f"landlords_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx")


@router.get("/contracts/export")
async def export_contracts(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    landlord_id: int | None = None,
    is_active: bool | None = None,
    start_date: str | None = None,
    end_date: str | None = None
):
    """Експорт контрактів у Excel"""
    query = select(LeaseContract).order_by(LeaseContract.contract_date.desc())
    if landlord_id:
        query = query.where(LeaseContract.landlord_id == landlord_id)
    if is_active is not None:
        query = query.where(LeaseContract.is_active == is_active)
    if start_date:
        try:
            sd = datetime.combine(date.fromisoformat(start_date), dtime.min)
            query = query.where(LeaseContract.contract_date >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.combine(date.fromisoformat(end_date), dtime(23, 59, 59))
            query = query.where(LeaseContract.contract_date <= ed)
        except ValueError:
            pass

    contracts = session.exec(query).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Контракти"
    headers = ["Орендодавець", "Поле", "Дата контракту", "Статус", "Культури", "Примітка"]
    _apply_header(ws, headers)

    active_fill = PatternFill("solid", fgColor="BBF7D0")
    inactive_fill = PatternFill("solid", fgColor="FECACA")

    for c in contracts:
        items = session.exec(
            select(LeaseContractItem).where(LeaseContractItem.contract_id == c.id)
        ).all()
        culture_parts = []
        for ci in items:
            culture = session.get(GrainCulture, ci.culture_id)
            culture_parts.append(
                f"{culture.name if culture else '?'}: {ci.quantity_kg:.0f} кг × {ci.price_per_kg_uah:.2f} грн"
            )

        ws.append([
            c.landlord_full_name,
            c.field_name,
            c.contract_date.strftime("%d.%m.%Y") if c.contract_date else "-",
            "Активний" if c.is_active else "Неактивний",
            "; ".join(culture_parts) or "-",
            c.note or "-"
        ])

    # Стилі
    for row in range(2, ws.max_row + 1):
        status_cell = ws.cell(row=row, column=4)
        if status_cell.value == "Активний":
            status_cell.fill = active_fill
        else:
            status_cell.fill = inactive_fill
        status_cell.alignment = Alignment(horizontal="center")

    _apply_body_style(ws, len(headers))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:F{ws.max_row}"
    widths = [30, 20, 16, 14, 50, 30]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + idx)].width = w

    return _to_response(wb, f"contracts_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx")


@router.get("/contracts/debt-export")
async def export_contracts_debt(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Excel: лише контракти оренди з невиплаченим залишком (ми винні орендодавцю). Повністю виплачені не потрапляють."""
    contracts = session.exec(
        select(LeaseContract).order_by(
            LeaseContract.landlord_full_name,
            LeaseContract.field_name,
            LeaseContract.id,
        )
    ).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Борг оренди"
    headers = [
        "Орендодавець",
        "Поле",
        "№ контракту",
        "Період дії",
        "Залишок до виплати, грн",
        "Активний",
        "Деталізація (залишок по позиціях)",
    ]
    _apply_header(ws, headers)

    debt_fill = PatternFill("solid", fgColor="FEF3C7")

    for c in contracts:
        cd = c.contract_date
        period_start = cd.date() if isinstance(cd, datetime) else cd
        if c.end_date:
            ed = c.end_date
            period_end = ed.date() if isinstance(ed, datetime) else ed
        else:
            period_end = add_one_year(period_start)

        items = session.exec(
            select(LeaseContractItem).where(LeaseContractItem.contract_id == c.id)
        ).all()
        paid_per = get_paid_per_culture(c.id, period_start, period_end, session)
        remaining_cash_uah = 0.0
        detail_parts: list[str] = []
        for ci in items:
            paid = float(paid_per.get(ci.culture_id, 0) or 0)
            rem_kg = max(0.0, float(ci.quantity_kg or 0) - paid)
            rem_uah = rem_kg * float(ci.price_per_kg_uah or 0)
            remaining_cash_uah += rem_uah
            if rem_kg > 0.001:
                culture = session.get(GrainCulture, ci.culture_id)
                cn = culture.name if culture else "?"
                detail_parts.append(
                    f"{cn}: {rem_kg:.2f} кг × {ci.price_per_kg_uah:.2f} грн/кг → {round(rem_uah, 2):.2f} грн"
                )
        remaining_cash_uah = round(remaining_cash_uah, 2)
        if remaining_cash_uah <= 0.01:
            continue

        date_from = period_start.strftime("%d.%m.%Y")
        date_to = period_end.strftime("%d.%m.%Y")
        ws.append(
            [
                c.landlord_full_name,
                c.field_name,
                c.id,
                f"{date_from} — {date_to}",
                remaining_cash_uah,
                "Так" if c.is_active else "Ні",
                "; ".join(detail_parts) if detail_parts else "—",
            ]
        )

    if ws.max_row == 1:
        ws.append(
            [
                "Немає контрактів із невиплаченим залишком",
                "",
                "",
                "",
                "",
                "",
                "",
            ]
        )

    for row in range(2, ws.max_row + 1):
        debt_cell = ws.cell(row=row, column=5)
        if isinstance(debt_cell.value, (int, float)) and float(debt_cell.value) > 0:
            debt_cell.fill = debt_fill

    _apply_body_style(ws, len(headers))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:G{ws.max_row}"
    widths = [32, 22, 14, 22, 20, 12, 70]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + idx)].width = w

    return _to_response(wb, f"lease_debt_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx")


@router.get("/payments/export")
async def export_payments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    contract_id: int | None = None,
    landlord_id: int | None = None,
    payment_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    show_cancelled: bool = False
):
    """Експорт виплат у Excel"""
    query = select(LeasePayment).order_by(LeasePayment.payment_date.desc())
    if contract_id:
        query = query.where(LeasePayment.contract_id == contract_id)
    if landlord_id:
        query = query.where(
            LeasePayment.contract_id.in_(
                select(LeaseContract.id).where(LeaseContract.landlord_id == landlord_id)
            )
        )
    if payment_type:
        query = query.where(LeasePayment.payment_type == payment_type)
    if not show_cancelled:
        query = query.where(LeasePayment.is_cancelled == False)
    if start_date:
        try:
            sd = datetime.combine(date.fromisoformat(start_date), dtime.min)
            query = query.where(LeasePayment.payment_date >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.combine(date.fromisoformat(end_date), dtime(23, 59, 59))
            query = query.where(LeasePayment.payment_date <= ed)
        except ValueError:
            pass

    payments = session.exec(query).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Виплати"
    headers = ["Дата", "Орендодавець", "Поле", "Тип", "Культури / Сума", "Валюта", "Статус", "Примітка"]
    _apply_header(ws, headers)

    grain_fill = PatternFill("solid", fgColor="BBF7D0")
    cash_fill = PatternFill("solid", fgColor="DBEAFE")
    cancelled_fill = PatternFill("solid", fgColor="FECACA")

    for p in payments:
        contract = session.get(LeaseContract, p.contract_id)
        grain_items = session.exec(
            select(LeasePaymentGrainItem).where(LeasePaymentGrainItem.payment_id == p.id)
        ).all()

        if grain_items:
            parts = []
            for gi in grain_items:
                culture = session.get(GrainCulture, gi.culture_id)
                parts.append(f"{culture.name if culture else '?'}: {gi.quantity_kg:.2f} кг")
            sum_text = "; ".join(parts)
        elif p.payment_type == "cash":
            sum_text = f"{p.amount:.2f}" if p.amount else "-"
        else:
            sum_text = "-"

        ws.append([
            p.payment_date.strftime("%d.%m.%Y") if p.payment_date else "-",
            contract.landlord_full_name if contract else "-",
            contract.field_name if contract else "-",
            "Зерном" if p.payment_type == "grain" else "Грошима",
            sum_text,
            p.currency or "-",
            "Скасовано" if p.is_cancelled else "Активна",
            p.note or "-"
        ])

    # Стилі
    for row in range(2, ws.max_row + 1):
        type_cell = ws.cell(row=row, column=4)
        status_cell = ws.cell(row=row, column=7)
        if status_cell.value == "Скасовано":
            status_cell.fill = cancelled_fill
        else:
            type_cell.fill = grain_fill if type_cell.value == "Зерном" else cash_fill

        type_cell.alignment = Alignment(horizontal="center")
        status_cell.alignment = Alignment(horizontal="center")

    _apply_body_style(ws, len(headers))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:H{ws.max_row}"
    widths = [14, 30, 20, 12, 45, 10, 14, 30]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + idx)].width = w

    return _to_response(wb, f"payments_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx")


@router.get("/payments", response_model=list[LeasePaymentResponse])
async def list_payments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    contract_id: Optional[int] = Query(None, description="Фільтр за контрактом")
):
    """Список виплат по контрактах"""
    query = select(LeasePayment)
    if contract_id:
        query = query.where(LeasePayment.contract_id == contract_id)

    payments = session.exec(query.order_by(LeasePayment.is_cancelled.asc(), LeasePayment.payment_date.desc())).all()

    result = []
    for payment in payments:
        contract = session.get(LeaseContract, payment.contract_id)
        payment_dict = payment.model_dump()

        if contract:
            payment_dict["contract_field_name"] = contract.field_name
            payment_dict["landlord_full_name"] = contract.landlord_full_name

        # Загружаем grain_items для всех типов виплат
        grain_items = session.exec(
            select(LeasePaymentGrainItem).where(
                LeasePaymentGrainItem.payment_id == payment.id
            )
        ).all()
        if grain_items:
            grain_items_list = []
            for item in grain_items:
                culture = session.get(GrainCulture, item.culture_id)
                item_dict = item.model_dump()
                item_dict["culture_name"] = culture.name if culture else None
                grain_items_list.append(LeasePaymentGrainItemResponse(**item_dict))
            payment_dict["grain_items"] = grain_items_list

        if payment.created_by_user_id:
            user = session.get(User, payment.created_by_user_id)
            payment_dict["created_by_user_full_name"] = user.full_name if user else None

        result.append(LeasePaymentResponse(**payment_dict))

    return result


@router.post("/payments", response_model=LeasePaymentResponse)
async def create_payment(
    payload: LeasePaymentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_super_admin)
):
    """Створення виплати по контракту з перевіркою залишку"""
    contract = session.get(LeaseContract, payload.contract_id)
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контракт не знайдено"
        )

    if payload.payment_type not in ["grain", "cash"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тип виплати має бути 'grain' або 'cash'"
        )

    if not payload.grain_items or len(payload.grain_items) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Додайте хоча б одну позицію виплати"
        )

    if payload.payment_type == "cash":
        if not payload.amount or payload.amount <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для виплати грошима вкажіть суму"
            )

    cd = contract.contract_date
    period_start = cd.date() if isinstance(cd, datetime) else cd
    if contract.end_date:
        ed = contract.end_date
        period_end = ed.date() if isinstance(ed, datetime) else ed
    else:
        period_end = add_one_year(period_start)
    paid_per_culture = get_paid_per_culture(
        payload.contract_id, period_start, period_end, session
    )

    contract_items = session.exec(
        select(LeaseContractItem).where(
            LeaseContractItem.contract_id == payload.contract_id
        )
    ).all()
    contract_items_map = {ci.culture_id: ci for ci in contract_items}

    # Дозволяємо виплати навіть після завершення/перевипуску контракту,
    # якщо залишок по цьому контракту ще є.
    total_remaining_cash_uah = 0.0
    for ci in contract_items:
        paid = float(paid_per_culture.get(ci.culture_id, 0) or 0)
        remaining = max(0.0, float(ci.quantity_kg or 0) - paid)
        total_remaining_cash_uah += remaining * float(ci.price_per_kg_uah or 0)
    total_remaining_cash_uah = round(total_remaining_cash_uah, 2)
    if total_remaining_cash_uah <= 0.01:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="По контракту вже все виплачено")

    for item in payload.grain_items:
        culture = session.get(GrainCulture, item.culture_id)
        if not culture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Культуру з ID {item.culture_id} не знайдено"
            )

        ci = contract_items_map.get(item.culture_id)
        if not ci:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Культура '{culture.name}' не входить до контракту"
            )

        paid = paid_per_culture.get(item.culture_id, 0)
        remaining = max(0, ci.quantity_kg - paid)
        if item.quantity_kg > remaining + 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Перевищено залишок для '{culture.name}': "
                       f"залишок {remaining:.2f} кг, запит {item.quantity_kg:.2f} кг"
            )

    # Создаем виплату
    payment = LeasePayment(
        contract_id=payload.contract_id,
        payment_type=payload.payment_type,
        currency=payload.currency if payload.payment_type == "cash" else None,
        amount=payload.amount if payload.payment_type == "cash" else None,
        payment_date=payload.payment_date,
        note=payload.note,
        created_by_user_id=current_user.id
    )
    session.add(payment)
    session.flush()

    # Добавляем позиции (для обоих типов — зерно и деньги)
    for item in payload.grain_items:
        grain_item = LeasePaymentGrainItem(
            payment_id=payment.id,
            culture_id=item.culture_id,
            quantity_kg=item.quantity_kg
        )
        session.add(grain_item)

    # === Списання зі складу / каси ===
    if payload.payment_type == "grain":
        # Списуємо зерно зі складу для кожної культури
        for item in payload.grain_items:
            if item.quantity_kg <= 0:
                continue
            culture = session.get(GrainCulture, item.culture_id)
            stock = session.exec(
                select(GrainStock).where(GrainStock.culture_id == item.culture_id)
            ).first()
            if not stock:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"На складі немає культури '{culture.name if culture else '?'}'"
                )
            # Можемо платити як нашим зерном, так і невикупленим у фермерів (farmer_quantity_kg),
            # бо воно фізично є на складі. Якщо використовуємо farmer_quantity_kg — це створює
            # зобов'язання перед фермерами викупити це зерно пізніше.
            if stock.quantity_kg < item.quantity_kg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Недостатньо '{culture.name}' на складі: "
                           f"є {stock.quantity_kg:.2f} кг, потрібно {item.quantity_kg:.2f} кг"
                )
            quantity_before = stock.quantity_kg
            need = float(item.quantity_kg)
            # Як при відправці: спочатку «віртуально» з зерна під зобов'язанням перед
            # фермерами (farmer_quantity_kg лишається лічильником боргу — не зменшуємо),
            # решту — з own_quantity_kg (лише в межах own, інакше дані складу неконсистентні).
            remaining = need
            farmer_virtual = 0.0
            fq = float(stock.farmer_quantity_kg or 0.0)
            if fq > 0:
                farmer_virtual = min(remaining, fq)
                remaining -= farmer_virtual
            oq = float(stock.own_quantity_kg or 0.0)
            take_own = min(remaining, oq)
            if remaining - take_own > 0.01:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Недостатньо власного зерна '{culture.name}' на складі для цієї виплати "
                           f"(після частки {farmer_virtual:.2f} кг під «невикуплене» потрібно ще "
                           f"{remaining:.2f} кг з own, є {oq:.2f} кг). Перевірте розподіл own / "
                           f"фізичний залишок."
                )

            stock.own_quantity_kg = max(0.0, oq - take_own)
            stock.quantity_kg = max(0.0, float(stock.quantity_kg or 0.0) - need)
            session.add(stock)

            # Зберігаємо фактичні дельти по колонках (для скасування). Частина з
            # farmer_virtual не змінює farmer_quantity_kg — from_farmer_kg = 0.
            gi = session.exec(
                select(LeasePaymentGrainItem).where(
                    LeasePaymentGrainItem.payment_id == payment.id,
                    LeasePaymentGrainItem.culture_id == item.culture_id
                )
            ).first()
            if gi:
                gi.from_own_kg = round(take_own, 2)
                gi.from_farmer_kg = 0.0
                session.add(gi)

            # Лог зміни складу
            dest = f"Виплата орендодавцю: {contract.landlord_full_name}"
            if farmer_virtual > 0.01:
                dest += f" (фізично з-під невикупленого у фермерів: {farmer_virtual:.2f} кг, борг лічильник не змінюється)"
            session.add(StockAdjustmentLog(
                stock_type=StockAdjustmentType.GRAIN,
                culture_id=item.culture_id,
                item_name=culture.name if culture else "?",
                transaction_type=TransactionType.SUBTRACT,
                amount=item.quantity_kg,
                quantity_before=quantity_before,
                quantity_after=stock.quantity_kg,
                user_id=current_user.id,
                user_full_name=current_user.full_name,
                source="lease_payment",
                destination=dest
            ))

    elif payload.payment_type == "cash":
        # Списуємо гроші з каси
        cash_register = session.exec(select(CashRegister)).first()
        if not cash_register:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Касу не знайдено"
            )
        currency_str = payload.currency or "UAH"
        balance_field_map = {"UAH": "uah_balance", "USD": "usd_balance", "EUR": "eur_balance"}
        balance_field = balance_field_map.get(currency_str, "uah_balance")
        current_balance = getattr(cash_register, balance_field)
        new_balance = current_balance - payload.amount
        # Дозволяємо касу в мінус при виплаті за контракт оренди
        setattr(cash_register, balance_field, new_balance)
        cash_register.updated_at = datetime.utcnow()
        session.add(cash_register)

        # Запис транзакції каси
        try:
            currency_enum = Currency(currency_str)
        except ValueError:
            currency_enum = Currency.UAH

        transaction = Transaction(
            currency=currency_enum,
            amount=payload.amount,
            transaction_type=TransactionType.SUBTRACT,
            user_id=current_user.id,
            description=f"Виплата орендодавцю: {contract.landlord_full_name} ({contract.field_name})",
            uah_balance_after=cash_register.uah_balance,
            usd_balance_after=cash_register.usd_balance,
            eur_balance_after=cash_register.eur_balance
        )
        session.add(transaction)

    session.commit()
    session.refresh(payment)

    # Формируем ответ
    payment_dict = payment.model_dump()
    payment_dict["contract_field_name"] = contract.field_name
    payment_dict["landlord_full_name"] = contract.landlord_full_name

    grain_items = session.exec(
        select(LeasePaymentGrainItem).where(
            LeasePaymentGrainItem.payment_id == payment.id
        )
    ).all()
    grain_items_list = []
    for item in grain_items:
        culture = session.get(GrainCulture, item.culture_id)
        item_dict = item.model_dump()
        item_dict["culture_name"] = culture.name if culture else None
        grain_items_list.append(LeasePaymentGrainItemResponse(**item_dict))
    payment_dict["grain_items"] = grain_items_list

    payment_dict["created_by_user_full_name"] = current_user.full_name

    return LeasePaymentResponse(**payment_dict)


@router.post("/payments/{payment_id}/cancel", response_model=LeasePaymentResponse)
async def cancel_payment(
    payment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_super_admin)
):
    """Скасування виплати з поверненням на склад / в касу"""
    payment = session.get(LeasePayment, payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Виплату не знайдено"
        )

    if payment.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Виплату вже було скасовано"
        )

    contract = session.get(LeaseContract, payment.contract_id)

    # Завантажуємо grain_items
    grain_items = session.exec(
        select(LeasePaymentGrainItem).where(
            LeasePaymentGrainItem.payment_id == payment.id
        )
    ).all()

    # === Повернення на склад / в касу ===
    if payment.payment_type == "grain":
        for item in grain_items:
            if item.quantity_kg <= 0:
                continue
            culture = session.get(GrainCulture, item.culture_id)
            stock = session.exec(
                select(GrainStock).where(GrainStock.culture_id == item.culture_id)
            ).first()
            if stock:
                quantity_before = stock.quantity_kg
                from_own = float(getattr(item, "from_own_kg", 0.0) or 0.0)
                from_farmer = float(getattr(item, "from_farmer_kg", 0.0) or 0.0)
                total = float(item.quantity_kg or 0.0)
                # Якщо split ще не збережений (старі записи) — повертаємо в "our" як було раніше
                if from_own <= 0 and from_farmer <= 0:
                    from_own = total
                    from_farmer = 0.0

                stock.own_quantity_kg += from_own
                stock.farmer_quantity_kg += from_farmer
                stock.quantity_kg += total
                session.add(stock)

                # Лог повернення
                session.add(StockAdjustmentLog(
                    stock_type=StockAdjustmentType.GRAIN,
                    culture_id=item.culture_id,
                    item_name=culture.name if culture else "?",
                    transaction_type=TransactionType.ADD,
                    amount=item.quantity_kg,
                    quantity_before=quantity_before,
                    quantity_after=stock.quantity_kg,
                    user_id=current_user.id,
                    user_full_name=current_user.full_name,
                    source="lease_payment_cancel",
                    destination=f"Скасування виплати #{payment.id} ({contract.landlord_full_name if contract else '?'})"
                ))

    elif payment.payment_type == "cash" and payment.amount:
        cash_register = session.exec(select(CashRegister)).first()
        if cash_register:
            currency_str = payment.currency or "UAH"
            balance_field_map = {"UAH": "uah_balance", "USD": "usd_balance", "EUR": "eur_balance"}
            balance_field = balance_field_map.get(currency_str, "uah_balance")

            current_balance = getattr(cash_register, balance_field)
            setattr(cash_register, balance_field, current_balance + payment.amount)
            cash_register.updated_at = datetime.utcnow()
            session.add(cash_register)

            try:
                currency_enum = Currency(currency_str)
            except ValueError:
                currency_enum = Currency.UAH

            transaction = Transaction(
                currency=currency_enum,
                amount=payment.amount,
                transaction_type=TransactionType.ADD,
                user_id=current_user.id,
                description=f"Скасування виплати #{payment.id} ({contract.landlord_full_name if contract else '?'}, {contract.field_name if contract else '?'})",
                uah_balance_after=cash_register.uah_balance,
                usd_balance_after=cash_register.usd_balance,
                eur_balance_after=cash_register.eur_balance
            )
            session.add(transaction)

    # Позначаємо виплату як скасовану
    payment.is_cancelled = True
    payment.updated_at = datetime.utcnow()
    session.add(payment)
    session.commit()
    session.refresh(payment)

    # Формуємо відповідь
    payment_dict = payment.model_dump()
    if contract:
        payment_dict["contract_field_name"] = contract.field_name
        payment_dict["landlord_full_name"] = contract.landlord_full_name

    grain_items_list = []
    for item in grain_items:
        culture = session.get(GrainCulture, item.culture_id)
        item_dict = item.model_dump()
        item_dict["culture_name"] = culture.name if culture else None
        grain_items_list.append(LeasePaymentGrainItemResponse(**item_dict))
    payment_dict["grain_items"] = grain_items_list

    if payment.created_by_user_id:
        user = session.get(User, payment.created_by_user_id)
        payment_dict["created_by_user_full_name"] = user.full_name if user else None

    return LeasePaymentResponse(**payment_dict)

