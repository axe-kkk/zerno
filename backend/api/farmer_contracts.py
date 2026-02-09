from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from sqlalchemy import func
from typing import Optional
from datetime import datetime, date, time as dtime
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from backend.database import get_session
from backend.models import (
    GrainOwner,
    GrainCulture,
    GrainIntake,
    GrainStock,
    PurchaseStock,
    CashRegister,
    Transaction,
    TransactionType,
    Currency,
    FarmerContract,
    FarmerContractItem,
    FarmerContractPayment,
    FarmerContractItemType,
    FarmerContractItemDirection,
    FarmerContractPaymentType,
    FarmerContractType,
    FarmerContractStatus,
    FarmerGrainDeduction,
    User
)
from backend.schemas import (
    FarmerContractCreate,
    FarmerContractResponse,
    FarmerContractDetailResponse,
    FarmerContractItemResponse,
    FarmerContractPaymentCreate,
    FarmerContractPaymentResponse
)
from backend.auth import get_current_user

router = APIRouter()


def _get_or_create_grain_stock(session: Session, culture_id: int) -> GrainStock:
    stock = session.exec(select(GrainStock).where(GrainStock.culture_id == culture_id)).first()
    if not stock:
        stock = GrainStock(
            culture_id=culture_id,
            quantity_kg=0.0,
            own_quantity_kg=0.0,
            farmer_quantity_kg=0.0,
            reserved_kg=0.0
        )
        session.add(stock)
        session.flush()
    return stock


def _get_cash_register(session: Session) -> CashRegister:
    register = session.exec(select(CashRegister)).first()
    if not register:
        register = CashRegister(uah_balance=0.0, usd_balance=0.0, eur_balance=0.0)
        session.add(register)
        session.flush()
    return register


def _get_farmer_balance(session: Session, owner_id: int, culture_id: int) -> float:
    total = session.exec(
        select(func.sum(GrainIntake.accepted_weight_kg)).where(
            GrainIntake.owner_id == owner_id,
            GrainIntake.culture_id == culture_id,
            GrainIntake.is_own_grain == False,
            GrainIntake.pending_quality == False
        )
    ).first() or 0.0
    deductions = session.exec(
        select(func.sum(FarmerGrainDeduction.quantity_kg)).where(
            FarmerGrainDeduction.owner_id == owner_id,
            FarmerGrainDeduction.culture_id == culture_id
        )
    ).first() or 0.0
    return float(total) - float(deductions)


def _find_or_create_purchase_stock_by_name(session: Session, name: str, category: str = "fertilizer") -> PurchaseStock:
    """Для резерву: шукаємо за назвою, якщо немає — створюємо з 0 кількістю."""
    import re
    normalized = re.sub(r'\s+', ' ', name.strip().lower())
    stock = session.exec(
        select(PurchaseStock).where(PurchaseStock.normalized_name == normalized)
    ).first()
    if stock:
        return stock
    # Створюємо нову позицію з 0 на складі
    stock = PurchaseStock(
        name=name.strip(),
        normalized_name=normalized,
        category=category,
        quantity_kg=0.0,
        reserved_kg=0.0,
        sale_price_per_kg=0.0
    )
    session.add(stock)
    session.flush()
    return stock


@router.get("", response_model=list[FarmerContractResponse])
async def list_farmer_contracts(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    owner_id: Optional[int] = Query(None),
    status_filter: Optional[FarmerContractStatus] = Query(None)
):
    query = select(FarmerContract).order_by(FarmerContract.created_at.desc())
    if owner_id:
        query = query.where(FarmerContract.owner_id == owner_id)
    if status_filter:
        query = query.where(FarmerContract.status == status_filter.value)
    return session.exec(query).all()


@router.get("/payments", response_model=list[FarmerContractPaymentResponse])
async def list_all_farmer_contract_payments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    owner_id: Optional[int] = Query(None),
    contract_id: Optional[int] = Query(None)
):
    query = select(FarmerContractPayment)
    if contract_id:
        query = query.where(FarmerContractPayment.contract_id == contract_id)
    if owner_id:
        query = query.join(FarmerContract, FarmerContract.id == FarmerContractPayment.contract_id)\
            .where(FarmerContract.owner_id == owner_id)
    query = query.order_by(FarmerContractPayment.payment_date.desc())
    return session.exec(query).all()


def _excel_header_style():
    return {
        "fill": PatternFill("solid", fgColor="1F2937"),
        "font": Font(name="Calibri", bold=True, color="FFFFFF", size=11),
        "alignment": Alignment(horizontal="center", vertical="center"),
        "border": Border(
            left=Side(style="thin", color="374151"),
            right=Side(style="thin", color="374151"),
            top=Side(style="thin", color="374151"),
            bottom=Side(style="thin", color="374151")
        )
    }


def _fc_apply_header(sheet, headers):
    sheet.append(headers)
    style = _excel_header_style()
    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = style["fill"]
        cell.font = style["font"]
        cell.alignment = style["alignment"]
        cell.border = style["border"]


def _fc_apply_body_style(sheet, num_cols):
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


def _fc_to_response(workbook, filename):
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export")
async def export_farmer_contracts(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    owner_id: Optional[int] = Query(None),
    contract_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """Експорт контрактів фермерів у Excel"""
    query = select(FarmerContract).order_by(FarmerContract.created_at.desc())
    if owner_id:
        query = query.where(FarmerContract.owner_id == owner_id)
    if contract_type:
        query = query.where(FarmerContract.contract_type == contract_type)
    if status_filter:
        query = query.where(FarmerContract.status == status_filter)
    if start_date:
        try:
            sd = datetime.combine(date.fromisoformat(start_date), dtime.min)
            query = query.where(FarmerContract.created_at >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.combine(date.fromisoformat(end_date), dtime(23, 59, 59))
            query = query.where(FarmerContract.created_at <= ed)
        except ValueError:
            pass

    contracts = session.exec(query).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Контракти фермерів"
    headers = ["№", "Фермер", "Тип", "Сума, грн", "Залишок, грн", "Статус", "Валюта", "Дата", "Примітка"]
    _fc_apply_header(ws, headers)

    type_labels = {"payment": "Виплата", "debt": "Контракт", "reserve": "Резерв", "exchange": "Обмін"}
    status_labels = {"open": "Відкритий", "pending": "Очікує", "closed": "Закритий", "cancelled": "Скасований"}
    dir_labels = {"from_company": "Від компанії", "from_farmer": "Від фермера"}
    open_fill = PatternFill("solid", fgColor="DBEAFE")
    closed_fill = PatternFill("solid", fgColor="BBF7D0")
    pending_fill = PatternFill("solid", fgColor="FEF3C7")
    cancelled_fill = PatternFill("solid", fgColor="FECACA")

    # Collect all items for second sheet
    all_items_data = []

    for c in contracts:
        owner = session.get(GrainOwner, c.owner_id)
        items = session.exec(
            select(FarmerContractItem).where(FarmerContractItem.contract_id == c.id)
        ).all()

        curr_text = ""
        if c.currency:
            curr_text = c.currency.upper()
            if c.exchange_rate:
                curr_text += f" (курс: {c.exchange_rate})"
        else:
            curr_text = "UAH"

        ws.append([
            c.id,
            owner.full_name if owner else f"#{c.owner_id}",
            type_labels.get(c.contract_type, c.contract_type),
            round(c.total_value_uah, 2),
            round(c.balance_uah, 2),
            status_labels.get(c.status, c.status),
            curr_text,
            c.created_at.strftime("%d.%m.%Y") if c.created_at else "-",
            c.note or "-"
        ])

        owner_name = owner.full_name if owner else f"#{c.owner_id}"
        for item in items:
            all_items_data.append((c.id, owner_name, item))

    for row in range(2, ws.max_row + 1):
        status_cell = ws.cell(row=row, column=6)
        val = status_cell.value
        if val == "Відкритий":
            status_cell.fill = open_fill
        elif val == "Закритий":
            status_cell.fill = closed_fill
        elif val == "Очікує":
            status_cell.fill = pending_fill
        elif val == "Скасований":
            status_cell.fill = cancelled_fill
        status_cell.alignment = Alignment(horizontal="center")

    _fc_apply_body_style(ws, len(headers))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{chr(64 + len(headers))}{ws.max_row}"
    widths = [8, 30, 14, 16, 16, 14, 18, 14, 30]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + idx)].width = w

    # ── Sheet 2: Позиції контрактів ──
    ws2 = wb.create_sheet("Позиції контрактів")
    item_headers = ["Контракт №", "Фермер", "Напрямок", "Позиція", "Кількість, кг", "Ціна, грн/кг", "Сума, грн", "Видано, кг"]
    _fc_apply_header(ws2, item_headers)
    for cid, oname, item in all_items_data:
        ws2.append([
            cid,
            oname,
            dir_labels.get(item.direction, item.direction),
            item.item_name or "-",
            round(item.quantity_kg, 2),
            round(item.price_per_kg, 2),
            round(item.total_value_uah, 2),
            round(item.delivered_kg, 2),
        ])
    _fc_apply_body_style(ws2, len(item_headers))
    ws2.freeze_panes = "A2"
    if ws2.max_row > 1:
        ws2.auto_filter.ref = f"A1:{chr(64 + len(item_headers))}{ws2.max_row}"
    item_widths = [12, 30, 18, 25, 16, 16, 16, 14]
    for idx, w in enumerate(item_widths, 1):
        ws2.column_dimensions[chr(64 + idx)].width = w

    return _fc_to_response(wb, f"farmer_contracts_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx")


@router.get("/payments/export")
async def export_farmer_contract_payments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    owner_id: Optional[int] = Query(None),
    contract_id: Optional[int] = Query(None),
    payment_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    show_cancelled: bool = Query(False)
):
    """Експорт виплат по контрактах фермерів у Excel"""
    query = select(FarmerContractPayment)
    if contract_id:
        query = query.where(FarmerContractPayment.contract_id == contract_id)
    if owner_id:
        query = query.join(FarmerContract, FarmerContract.id == FarmerContractPayment.contract_id)\
            .where(FarmerContract.owner_id == owner_id)
    if payment_type:
        query = query.where(FarmerContractPayment.payment_type == payment_type)
    if not show_cancelled:
        query = query.where(FarmerContractPayment.is_cancelled == False)
    if start_date:
        try:
            sd = datetime.combine(date.fromisoformat(start_date), dtime.min)
            query = query.where(FarmerContractPayment.payment_date >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.combine(date.fromisoformat(end_date), dtime(23, 59, 59))
            query = query.where(FarmerContractPayment.payment_date <= ed)
        except ValueError:
            pass

    payments = session.exec(query.order_by(FarmerContractPayment.payment_date.desc())).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "Виплати по контрактах"
    headers = ["Дата", "Фермер", "Контракт", "Тип", "Позиція", "Кількість, кг", "Сума", "Валюта", "Курс", "Сума, грн", "Статус"]
    _fc_apply_header(ws, headers)

    type_labels = {
        "goods_issue": "Видача",
        "goods_receive": "Прийом",
        "cash": "Гроші",
        "grain": "Зерно",
        "settlement": "Розрахунок"
    }
    active_fill = PatternFill("solid", fgColor="BBF7D0")
    cancelled_fill = PatternFill("solid", fgColor="FECACA")

    for p in payments:
        contract = session.get(FarmerContract, p.contract_id)
        owner_name = "-"
        if contract:
            owner = session.get(GrainOwner, contract.owner_id)
            owner_name = owner.full_name if owner else f"#{contract.owner_id}"

        ws.append([
            p.payment_date.strftime("%d.%m.%Y") if p.payment_date else "-",
            owner_name,
            f"#{p.contract_id}",
            type_labels.get(p.payment_type, p.payment_type),
            p.item_name or "-",
            round(p.quantity_kg, 2) if p.quantity_kg else "-",
            round(p.amount, 2) if p.amount else "-",
            (p.currency or "UAH").upper(),
            p.exchange_rate if p.exchange_rate else "-",
            round(p.amount_uah, 2) if p.amount_uah else "-",
            "Скасовано" if p.is_cancelled else "Активна"
        ])

    for row in range(2, ws.max_row + 1):
        status_cell = ws.cell(row=row, column=11)
        if status_cell.value == "Скасовано":
            status_cell.fill = cancelled_fill
        else:
            status_cell.fill = active_fill
        status_cell.alignment = Alignment(horizontal="center")

    _fc_apply_body_style(ws, len(headers))
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{chr(64 + len(headers))}{ws.max_row}"
    widths = [14, 30, 12, 14, 25, 16, 14, 10, 10, 16, 14]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + idx)].width = w

    return _fc_to_response(wb, f"farmer_payments_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx")


@router.get("/{contract_id}/export")
async def export_single_farmer_contract(
    contract_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Експорт деталей одного контракту фермера у Excel"""
    contract = session.get(FarmerContract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Контракт не знайдено")

    owner = session.get(GrainOwner, contract.owner_id)
    owner_name = owner.full_name if owner else f"#{contract.owner_id}"
    items = session.exec(
        select(FarmerContractItem).where(FarmerContractItem.contract_id == contract_id)
    ).all()
    payments = session.exec(
        select(FarmerContractPayment)
        .where(FarmerContractPayment.contract_id == contract_id)
        .order_by(FarmerContractPayment.payment_date.desc())
    ).all()

    type_labels = {"payment": "Виплата", "debt": "Контракт", "reserve": "Резерв", "exchange": "Обмін"}
    status_labels = {"open": "Відкритий", "pending": "Очікує", "closed": "Закритий", "cancelled": "Скасований"}
    dir_labels = {"from_company": "Від компанії", "from_farmer": "Від фермера"}
    pay_type_labels = {
        "goods_issue": "Видача", "goods_receive": "Прийом",
        "cash": "Гроші", "grain": "Зерно", "settlement": "Розрахунок"
    }

    wb = Workbook()

    # ── Sheet 1: Інформація ──
    ws_info = wb.active
    ws_info.title = "Контракт"

    title_font = Font(bold=True, size=16, color="1F2937")
    label_font = Font(bold=True, size=11, color="64748B")
    value_font = Font(size=12, color="1F2937")
    section_font = Font(bold=True, size=13, color="1F2937")
    section_fill = PatternFill("solid", fgColor="EFF6FF")

    ws_info.merge_cells("A1:D1")
    cell_title = ws_info.cell(row=1, column=1)
    cell_title.value = f"Контракт #{contract_id}"
    cell_title.font = title_font
    cell_title.alignment = Alignment(vertical="center")
    ws_info.row_dimensions[1].height = 30

    curr_text = ""
    if contract.currency:
        curr_text = contract.currency.upper()
        if contract.exchange_rate:
            curr_text += f" (курс: {contract.exchange_rate})"
    else:
        curr_text = "UAH"

    info_data = [
        ("Фермер", owner_name),
        ("Тип", type_labels.get(contract.contract_type, contract.contract_type)),
        ("Статус", status_labels.get(contract.status, contract.status)),
        ("Дата створення", contract.created_at.strftime("%d.%m.%Y %H:%M") if contract.created_at else "-"),
        ("Сума контракту, грн", round(contract.total_value_uah, 2)),
        ("Залишок, грн", round(contract.balance_uah, 2)),
        ("Валюта / Курс", curr_text),
        ("Примітка", contract.note or "—"),
    ]

    for i, (label, val) in enumerate(info_data, 3):
        cl = ws_info.cell(row=i, column=1)
        cl.value = label
        cl.font = label_font
        cv = ws_info.cell(row=i, column=2)
        cv.value = val
        cv.font = value_font

    ws_info.column_dimensions["A"].width = 25
    ws_info.column_dimensions["B"].width = 40

    # ── Sheet 2: Позиції ──
    ws_items = wb.create_sheet("Позиції")
    item_headers = ["Напрямок", "Позиція", "Кількість, кг", "Ціна, грн/кг", "Сума, грн", "Видано, кг"]
    _fc_apply_header(ws_items, item_headers)
    for item in items:
        ws_items.append([
            dir_labels.get(item.direction, item.direction),
            item.item_name or "-",
            round(item.quantity_kg, 2),
            round(item.price_per_kg, 2),
            round(item.total_value_uah, 2),
            round(item.delivered_kg, 2),
        ])
    _fc_apply_body_style(ws_items, len(item_headers))
    ws_items.freeze_panes = "A2"
    if ws_items.max_row > 1:
        ws_items.auto_filter.ref = f"A1:{chr(64 + len(item_headers))}{ws_items.max_row}"
    item_widths = [20, 28, 16, 16, 16, 14]
    for idx, w in enumerate(item_widths, 1):
        ws_items.column_dimensions[chr(64 + idx)].width = w

    # ── Sheet 3: Операції ──
    ws_pay = wb.create_sheet("Операції")
    pay_headers = ["Дата", "Тип", "Позиція", "Кількість, кг", "Сума", "Валюта", "Курс", "Сума, грн", "Статус"]
    _fc_apply_header(ws_pay, pay_headers)
    active_fill = PatternFill("solid", fgColor="BBF7D0")
    cancelled_fill = PatternFill("solid", fgColor="FECACA")
    for p in payments:
        ws_pay.append([
            p.payment_date.strftime("%d.%m.%Y") if p.payment_date else "-",
            pay_type_labels.get(p.payment_type, p.payment_type),
            p.item_name or "-",
            round(p.quantity_kg, 2) if p.quantity_kg else "-",
            round(p.amount, 2) if p.amount else "-",
            (p.currency or "UAH").upper(),
            p.exchange_rate if p.exchange_rate else "-",
            round(p.amount_uah, 2) if p.amount_uah else "-",
            "Скасовано" if p.is_cancelled else "Активна"
        ])
    for row in range(2, ws_pay.max_row + 1):
        status_cell = ws_pay.cell(row=row, column=9)
        if status_cell.value == "Скасовано":
            status_cell.fill = cancelled_fill
        else:
            status_cell.fill = active_fill
        status_cell.alignment = Alignment(horizontal="center")
    _fc_apply_body_style(ws_pay, len(pay_headers))
    ws_pay.freeze_panes = "A2"
    if ws_pay.max_row > 1:
        ws_pay.auto_filter.ref = f"A1:{chr(64 + len(pay_headers))}{ws_pay.max_row}"
    pay_widths = [14, 14, 25, 16, 14, 10, 10, 16, 14]
    for idx, w in enumerate(pay_widths, 1):
        ws_pay.column_dimensions[chr(64 + idx)].width = w

    return _fc_to_response(
        wb, f"contract_{contract_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    )


@router.get("/{contract_id}", response_model=FarmerContractDetailResponse)
async def get_farmer_contract(
    contract_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    contract = session.get(FarmerContract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Контракт не знайдено")
    items = session.exec(
        select(FarmerContractItem).where(FarmerContractItem.contract_id == contract_id)
    ).all()
    return FarmerContractDetailResponse(
        **contract.dict(),
        items=[FarmerContractItemResponse.from_orm(item) for item in items]
    )


@router.post("", response_model=FarmerContractDetailResponse)
async def create_farmer_contract(
    payload: FarmerContractCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    owner = session.get(GrainOwner, payload.owner_id)
    if not owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Фермера не знайдено")

    ctype = payload.contract_type

    # ─────────────────────────────────────────────
    #  PAYMENT — контракт виплати (миттєвий розрахунок)
    # ─────────────────────────────────────────────
    if ctype == FarmerContractType.PAYMENT:
        if not payload.farmer_items:
            raise HTTPException(status_code=400, detail="Вкажіть зерно фермера для обміну на гроші")

        # Валідуємо та збираємо позиції
        farmer_total = 0.0
        items_to_create = []
        for fi in payload.farmer_items:
            if fi.item_type != FarmerContractItemType.GRAIN or not fi.culture_id:
                raise HTTPException(status_code=400, detail="Для контракту виплати потрібні лише культури зерна")
            culture = session.get(GrainCulture, fi.culture_id)
            if not culture:
                raise HTTPException(status_code=404, detail="Культуру не знайдено")
            price = fi.price_per_kg or culture.price_per_kg
            available = _get_farmer_balance(session, payload.owner_id, fi.culture_id)
            if fi.quantity_kg > available + 0.01:
                raise HTTPException(status_code=400, detail=f"Недостатньо {culture.name} на балансі. Доступно: {available:.2f}")
            total_uah = fi.quantity_kg * price
            farmer_total += total_uah
            items_to_create.append(FarmerContractItem(
                contract_id=0,
                direction=FarmerContractItemDirection.FROM_FARMER.value,
                item_type=FarmerContractItemType.GRAIN.value,
                culture_id=fi.culture_id,
                item_name=culture.name,
                quantity_kg=fi.quantity_kg,
                price_per_kg=price,
                total_value_uah=total_uah,
                delivered_kg=fi.quantity_kg  # одразу видано
            ))

        # Визначаємо суму у вибраній валюті
        currency_str = payload.currency or "UAH"
        currency_enum = Currency(currency_str)
        exchange_rate = payload.exchange_rate
        if currency_enum != Currency.UAH and (not exchange_rate or exchange_rate <= 0):
            raise HTTPException(status_code=400, detail="Вкажіть курс валюти")
        if currency_enum == Currency.UAH:
            payout_amount = farmer_total
        else:
            payout_amount = round(farmer_total / exchange_rate, 2)

        # Створюємо контракт (відразу закритий)
        contract = FarmerContract(
            owner_id=payload.owner_id,
            contract_type=FarmerContractType.PAYMENT.value,
            status=FarmerContractStatus.CLOSED.value,
            total_value_uah=farmer_total,
            balance_uah=0.0,
            currency=currency_str,
            exchange_rate=exchange_rate,
            note=payload.note,
            created_by_user_id=current_user.id
        )
        session.add(contract)
        session.flush()

        for item in items_to_create:
            item.contract_id = contract.id
            session.add(item)
        session.flush()

        # Рухи на складі: фермерське зерно → наше
        for item in items_to_create:
            stock = _get_or_create_grain_stock(session, item.culture_id)
            stock.farmer_quantity_kg = max(0.0, stock.farmer_quantity_kg - item.quantity_kg)
            stock.own_quantity_kg += item.quantity_kg
            session.add(stock)
            # Списання з балансу фермера
            session.add(FarmerGrainDeduction(
                owner_id=payload.owner_id,
                culture_id=item.culture_id,
                quantity_kg=item.quantity_kg
            ))

        # Списуємо гроші з каси
        cash_register = _get_cash_register(session)
        balance_field_map = {Currency.UAH: "uah_balance", Currency.USD: "usd_balance", Currency.EUR: "eur_balance"}
        field = balance_field_map[currency_enum]
        new_balance = getattr(cash_register, field) - payout_amount
        setattr(cash_register, field, new_balance)
        session.add(cash_register)
        session.add(Transaction(
            currency=currency_enum,
            amount=payout_amount,
            transaction_type=TransactionType.SUBTRACT,
            user_id=current_user.id,
            description=f"Виплата фермеру за контрактом #{contract.id} ({owner.full_name})",
            uah_balance_after=cash_register.uah_balance,
            usd_balance_after=cash_register.usd_balance,
            eur_balance_after=cash_register.eur_balance
        ))

        # Запис виплати (settlement)
        settlement = FarmerContractPayment(
            contract_id=contract.id,
            payment_type=FarmerContractPaymentType.SETTLEMENT.value,
            item_name=f"Виплата {currency_str}",
            amount=payout_amount,
            currency=currency_enum,
            exchange_rate=exchange_rate,
            amount_uah=farmer_total,
            created_by_user_id=current_user.id
        )
        session.add(settlement)
        session.commit()
        session.refresh(contract)

        return FarmerContractDetailResponse(
            **contract.dict(),
            items=[FarmerContractItemResponse.from_orm(i) for i in items_to_create]
        )

    # ─────────────────────────────────────────────
    #  RESERVE — контракт резерву (очікує наявності)
    # ─────────────────────────────────────────────
    if ctype == FarmerContractType.RESERVE:
        if not payload.company_items:
            raise HTTPException(status_code=400, detail="Вкажіть що фермер хоче зарезервувати")

        company_total = 0.0
        items_to_create = []
        for ci in payload.company_items:
            if ci.quantity_kg <= 0:
                raise HTTPException(status_code=400, detail="Кількість має бути більше 0")
            if ci.price_per_kg <= 0:
                raise HTTPException(status_code=400, detail="Вкажіть ціну резерву")

            price = ci.price_per_kg
            purchase_stock_id = ci.purchase_stock_id
            culture_id = ci.culture_id

            if ci.item_type == FarmerContractItemType.GRAIN:
                # Зерно — шукаємо по culture_id
                if ci.culture_id:
                    culture = session.get(GrainCulture, ci.culture_id)
                    if not culture:
                        raise HTTPException(status_code=404, detail="Культуру не знайдено")
                    item_name = culture.name
                    stock = _get_or_create_grain_stock(session, ci.culture_id)
                    stock.reserved_kg += ci.quantity_kg
                    session.add(stock)
                else:
                    raise HTTPException(status_code=400, detail="Оберіть культуру")
            elif ci.item_type == FarmerContractItemType.PURCHASE:
                # Товар — шукаємо за id або створюємо за назвою
                if ci.purchase_stock_id:
                    stock = session.get(PurchaseStock, ci.purchase_stock_id)
                    if not stock:
                        raise HTTPException(status_code=404, detail="Позицію складу не знайдено")
                    item_name = stock.name
                elif ci.item_name:
                    # Нова позиція — створюємо на складі з 0 кількістю
                    stock = _find_or_create_purchase_stock_by_name(session, ci.item_name)
                    purchase_stock_id = stock.id
                    item_name = stock.name
                else:
                    raise HTTPException(status_code=400, detail="Вкажіть назву позиції")
                stock.reserved_kg += ci.quantity_kg
                session.add(stock)
            else:
                item_name = ci.item_name or "Інше"

            total_uah = ci.quantity_kg * price
            company_total += total_uah
            items_to_create.append(FarmerContractItem(
                contract_id=0,
                direction=FarmerContractItemDirection.FROM_COMPANY.value,
                item_type=ci.item_type.value if hasattr(ci.item_type, 'value') else ci.item_type,
                culture_id=culture_id,
                purchase_stock_id=purchase_stock_id,
                item_name=item_name,
                quantity_kg=ci.quantity_kg,
                price_per_kg=price,
                total_value_uah=total_uah
            ))

        contract = FarmerContract(
            owner_id=payload.owner_id,
            contract_type=FarmerContractType.RESERVE.value,
            status=FarmerContractStatus.PENDING.value,
            total_value_uah=company_total,
            balance_uah=company_total,
            note=payload.note,
            created_by_user_id=current_user.id
        )
        session.add(contract)
        session.flush()

        for item in items_to_create:
            item.contract_id = contract.id
            session.add(item)

        session.commit()
        session.refresh(contract)

        return FarmerContractDetailResponse(
            **contract.dict(),
            items=[FarmerContractItemResponse.from_orm(i) for i in items_to_create]
        )

    # ─────────────────────────────────────────────
    #  DEBT / EXCHANGE — борговий або обмінний контракт
    # ─────────────────────────────────────────────
    if not payload.farmer_items and not payload.company_items:
        raise HTTPException(status_code=400, detail="Додайте позиції контракту")

    company_total = 0.0
    farmer_total = 0.0
    items_to_create: list[FarmerContractItem] = []

    def build_item(item, direction):
        if item.quantity_kg <= 0:
            raise HTTPException(status_code=400, detail="Кількість має бути більше 0")

        if item.item_type == FarmerContractItemType.GRAIN:
            if not item.culture_id:
                raise HTTPException(status_code=400, detail="Оберіть культуру")
            culture = session.get(GrainCulture, item.culture_id)
            if not culture:
                raise HTTPException(status_code=404, detail="Культуру не знайдено")
            price = item.price_per_kg or culture.price_per_kg
            item_name = culture.name
            if direction == FarmerContractItemDirection.FROM_COMPANY:
                stock = _get_or_create_grain_stock(session, item.culture_id)
                available = stock.own_quantity_kg - stock.reserved_kg
                if item.quantity_kg > available + 0.01:
                    raise HTTPException(status_code=400, detail=f"Недостатньо доступного зерна {culture.name}. Доступно: {available:.2f}")
                stock.reserved_kg += item.quantity_kg
            else:
                available = _get_farmer_balance(session, payload.owner_id, item.culture_id)
                if item.quantity_kg > available + 0.01:
                    raise HTTPException(status_code=400, detail=f"Недостатньо {culture.name} на балансі фермера. Доступно: {available:.2f}")
        elif item.item_type == FarmerContractItemType.PURCHASE:
            if not item.purchase_stock_id:
                raise HTTPException(status_code=400, detail="Оберіть позицію складу")
            stock = session.get(PurchaseStock, item.purchase_stock_id)
            if not stock:
                raise HTTPException(status_code=404, detail="Позицію складу не знайдено")
            price = item.price_per_kg or stock.sale_price_per_kg
            if direction == FarmerContractItemDirection.FROM_COMPANY:
                available = stock.quantity_kg - stock.reserved_kg
                if item.quantity_kg > available + 0.01:
                    raise HTTPException(status_code=400, detail=f"Недостатньо {stock.name} на складі. Доступно: {available:.2f}")
                stock.reserved_kg += item.quantity_kg
            item_name = stock.name
        else:
            price = item.price_per_kg or 1.0
            item_name = "Готівка"

        items_to_create.append(FarmerContractItem(
            contract_id=0,
            direction=direction.value if hasattr(direction, 'value') else direction,
            item_type=item.item_type.value if hasattr(item.item_type, 'value') else item.item_type,
            culture_id=item.culture_id,
            purchase_stock_id=item.purchase_stock_id,
            item_name=item_name,
            quantity_kg=item.quantity_kg,
            price_per_kg=price,
            total_value_uah=item.quantity_kg * price
        ))
        return item.quantity_kg * price

    for item in payload.company_items:
        company_total += build_item(item, FarmerContractItemDirection.FROM_COMPANY)

    for item in payload.farmer_items:
        farmer_total += build_item(item, FarmerContractItemDirection.FROM_FARMER)

    contract = FarmerContract(
        owner_id=payload.owner_id,
        contract_type=payload.contract_type.value if hasattr(payload.contract_type, 'value') else payload.contract_type,
        status=FarmerContractStatus.OPEN.value,
        total_value_uah=company_total,
        balance_uah=max(company_total - farmer_total, 0.0),
        note=payload.note,
        created_by_user_id=current_user.id
    )
    session.add(contract)
    session.flush()

    for item in items_to_create:
        item.contract_id = contract.id
        session.add(item)

    session.commit()
    session.refresh(contract)

    return FarmerContractDetailResponse(
        **contract.dict(),
        items=[FarmerContractItemResponse.from_orm(i) for i in items_to_create]
    )


@router.post("/{contract_id}/activate", response_model=FarmerContractResponse)
async def activate_reserve_contract(
    contract_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Активувати резервний контракт → перетворити в борговий"""
    contract = session.get(FarmerContract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Контракт не знайдено")
    if contract.contract_type != FarmerContractType.RESERVE.value:
        raise HTTPException(status_code=400, detail="Тільки резервні контракти можна активувати")
    if contract.status != FarmerContractStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Контракт не в стані очікування")

    # Перевіряємо, чи є достатньо товару на складі
    items = session.exec(
        select(FarmerContractItem).where(FarmerContractItem.contract_id == contract_id)
    ).all()
    for item in items:
        if item.item_type == FarmerContractItemType.GRAIN.value and item.culture_id:
            stock = _get_or_create_grain_stock(session, item.culture_id)
            available = stock.own_quantity_kg - (stock.reserved_kg - item.quantity_kg)
            if item.quantity_kg > available + 0.01:
                raise HTTPException(
                    status_code=400,
                    detail=f"Недостатньо {item.item_name} на складі для активації. Потрібно: {item.quantity_kg:.2f}, доступно: {available:.2f}"
                )
        elif item.item_type == FarmerContractItemType.PURCHASE.value and item.purchase_stock_id:
            pstock = session.get(PurchaseStock, item.purchase_stock_id)
            if pstock:
                available = pstock.quantity_kg - (pstock.reserved_kg - item.quantity_kg)
                if item.quantity_kg > available + 0.01:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Недостатньо {item.item_name} на складі для активації. Потрібно: {item.quantity_kg:.2f}, доступно: {available:.2f}"
                    )

    contract.contract_type = FarmerContractType.DEBT.value
    contract.status = FarmerContractStatus.OPEN.value
    contract.was_reserve = True
    contract.note = (contract.note or "") + " [Активовано з резерву]"
    session.add(contract)
    session.commit()
    session.refresh(contract)
    return contract


@router.post("/{contract_id}/close", response_model=FarmerContractResponse)
async def close_farmer_contract(
    contract_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Закрити контракт вручну"""
    contract = session.get(FarmerContract, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Контракт не знайдено")
    if contract.status not in (FarmerContractStatus.OPEN.value, FarmerContractStatus.PENDING.value):
        raise HTTPException(status_code=400, detail="Контракт вже закритий або скасований")

    # Знімаємо бронювання для невиданих позицій
    items = session.exec(
        select(FarmerContractItem).where(FarmerContractItem.contract_id == contract_id)
    ).all()
    for item in items:
        unreserve_qty = max(0.0, item.quantity_kg - item.delivered_kg)
        if unreserve_qty <= 0:
            continue
        if item.direction != FarmerContractItemDirection.FROM_COMPANY.value:
            continue
        if item.item_type == FarmerContractItemType.GRAIN.value and item.culture_id:
            stock = _get_or_create_grain_stock(session, item.culture_id)
            stock.reserved_kg = max(0.0, stock.reserved_kg - unreserve_qty)
            session.add(stock)
        elif item.item_type == FarmerContractItemType.PURCHASE.value and item.purchase_stock_id:
            pstock = session.get(PurchaseStock, item.purchase_stock_id)
            if pstock:
                pstock.reserved_kg = max(0.0, pstock.reserved_kg - unreserve_qty)
                session.add(pstock)

    contract.status = FarmerContractStatus.CLOSED.value
    session.add(contract)
    session.commit()
    session.refresh(contract)
    return contract


@router.get("/{contract_id}/payments", response_model=list[FarmerContractPaymentResponse])
async def list_farmer_contract_payments(
    contract_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    contract = session.get(FarmerContract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Контракт не знайдено")
    payments = session.exec(
        select(FarmerContractPayment).where(FarmerContractPayment.contract_id == contract_id)
        .order_by(FarmerContractPayment.payment_date.desc())
    ).all()
    return payments


def _check_contract_completion(session: Session, contract: FarmerContract):
    """Перевірити чи контракт повністю виконаний"""
    if contract.balance_uah > 0.01:
        return  # Ще є борг
    items = session.exec(
        select(FarmerContractItem).where(FarmerContractItem.contract_id == contract.id)
    ).all()
    if not items:
        contract.status = FarmerContractStatus.CLOSED.value
        return
    all_delivered = all(item.delivered_kg >= item.quantity_kg - 0.01 for item in items)
    if all_delivered:
        contract.status = FarmerContractStatus.CLOSED.value


@router.post("/{contract_id}/payments", response_model=FarmerContractPaymentResponse)
async def create_farmer_contract_payment(
    contract_id: int,
    payload: FarmerContractPaymentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    contract = session.get(FarmerContract, contract_id)
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Контракт не знайдено")
    if contract.status != FarmerContractStatus.OPEN.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Контракт не активний")

    owner = session.get(GrainOwner, contract.owner_id)
    amount_uah = 0.0
    payment = None

    # ─── GOODS_ISSUE: ми видаємо товар фермеру ───
    if payload.payment_type == FarmerContractPaymentType.GOODS_ISSUE:
        if not payload.contract_item_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Оберіть позицію контракту")
        if not payload.quantity_kg or payload.quantity_kg <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Вкажіть кількість")

        item = session.get(FarmerContractItem, payload.contract_item_id)
        if not item or item.contract_id != contract_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Позицію не знайдено")
        if item.direction != FarmerContractItemDirection.FROM_COMPANY.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ця позиція не від компанії")

        remaining = item.quantity_kg - item.delivered_kg
        if payload.quantity_kg > remaining + 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Кількість перевищує залишок. Залишок: {remaining:.2f}"
            )

        amount_uah = payload.quantity_kg * item.price_per_kg

        # Списуємо зі складу
        if item.item_type == FarmerContractItemType.GRAIN.value and item.culture_id:
            stock = _get_or_create_grain_stock(session, item.culture_id)
            stock.reserved_kg = max(0.0, stock.reserved_kg - payload.quantity_kg)
            stock.own_quantity_kg = max(0.0, stock.own_quantity_kg - payload.quantity_kg)
            stock.quantity_kg = max(0.0, stock.quantity_kg - payload.quantity_kg)
            session.add(stock)
        elif item.item_type == FarmerContractItemType.PURCHASE.value and item.purchase_stock_id:
            pstock = session.get(PurchaseStock, item.purchase_stock_id)
            if pstock:
                pstock.reserved_kg = max(0.0, pstock.reserved_kg - payload.quantity_kg)
                pstock.quantity_kg = max(0.0, pstock.quantity_kg - payload.quantity_kg)
                session.add(pstock)
        elif item.item_type == FarmerContractItemType.CASH.value:
            cash_register = _get_cash_register(session)
            cash_register.uah_balance -= payload.quantity_kg
            session.add(cash_register)
            session.add(Transaction(
                currency=Currency.UAH,
                amount=payload.quantity_kg,
                transaction_type=TransactionType.SUBTRACT,
                user_id=current_user.id,
                description=f"Видача за контрактом фермера #{contract_id}",
                uah_balance_after=cash_register.uah_balance,
                usd_balance_after=cash_register.usd_balance,
                eur_balance_after=cash_register.eur_balance
            ))

        item.delivered_kg += payload.quantity_kg
        session.add(item)

        payment = FarmerContractPayment(
            contract_id=contract_id,
            contract_item_id=item.id,
            payment_type=payload.payment_type.value if hasattr(payload.payment_type, 'value') else payload.payment_type,
            item_name=item.item_name,
            amount=0.0,
            currency=Currency.UAH,
            amount_uah=amount_uah,
            quantity_kg=payload.quantity_kg,
            culture_id=item.culture_id,
            created_by_user_id=current_user.id
        )
        session.add(payment)
        # Видача НЕ зменшує balance_uah

    # ─── GOODS_RECEIVE: фермер передає товар нам (обмін) ───
    elif payload.payment_type == FarmerContractPaymentType.GOODS_RECEIVE:
        if not payload.contract_item_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Оберіть позицію контракту")
        if not payload.quantity_kg or payload.quantity_kg <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Вкажіть кількість")

        item = session.get(FarmerContractItem, payload.contract_item_id)
        if not item or item.contract_id != contract_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Позицію не знайдено")
        if item.direction != FarmerContractItemDirection.FROM_FARMER.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ця позиція не від фермера")

        remaining = item.quantity_kg - item.delivered_kg
        if payload.quantity_kg > remaining + 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Кількість перевищує залишок. Залишок: {remaining:.2f}"
            )

        amount_uah = payload.quantity_kg * item.price_per_kg

        # Приймаємо товар від фермера
        if item.item_type == FarmerContractItemType.GRAIN.value and item.culture_id:
            available = _get_farmer_balance(session, contract.owner_id, item.culture_id)
            if payload.quantity_kg > available + 0.01:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Недостатньо зерна на балансі фермера. Доступно: {available:.2f}"
                )
            stock = _get_or_create_grain_stock(session, item.culture_id)
            stock.farmer_quantity_kg -= payload.quantity_kg
            stock.own_quantity_kg += payload.quantity_kg
            session.add(stock)
        elif item.item_type == FarmerContractItemType.CASH.value:
            cash_register = _get_cash_register(session)
            cash_register.uah_balance += payload.quantity_kg
            session.add(cash_register)
            session.add(Transaction(
                currency=Currency.UAH,
                amount=payload.quantity_kg,
                transaction_type=TransactionType.ADD,
                user_id=current_user.id,
                description=f"Прийом за контрактом фермера #{contract_id}",
                uah_balance_after=cash_register.uah_balance,
                usd_balance_after=cash_register.usd_balance,
                eur_balance_after=cash_register.eur_balance
            ))

        item.delivered_kg += payload.quantity_kg
        session.add(item)

        payment = FarmerContractPayment(
            contract_id=contract_id,
            contract_item_id=item.id,
            payment_type=payload.payment_type.value if hasattr(payload.payment_type, 'value') else payload.payment_type,
            item_name=item.item_name,
            amount=0.0,
            currency=Currency.UAH,
            amount_uah=amount_uah,
            quantity_kg=payload.quantity_kg,
            culture_id=item.culture_id,
            created_by_user_id=current_user.id
        )
        session.add(payment)

        # Для зерна — запис списання з балансу фермера
        if item.item_type == FarmerContractItemType.GRAIN.value and item.culture_id:
            session.flush()
            session.add(FarmerGrainDeduction(
                owner_id=contract.owner_id,
                culture_id=item.culture_id,
                quantity_kg=payload.quantity_kg,
                payment_id=payment.id
            ))
        # Прийом НЕ зменшує balance_uah

    # ─── CASH: фермер платить грошима (зменшує борг) ───
    elif payload.payment_type == FarmerContractPaymentType.CASH:
        if payload.amount is None or payload.amount <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Вкажіть суму")
        if payload.currency != Currency.UAH:
            if not payload.exchange_rate or payload.exchange_rate <= 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Вкажіть курс")
            amount_uah = payload.amount * payload.exchange_rate
        else:
            amount_uah = payload.amount

        if amount_uah > contract.balance_uah + 0.01:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сума перевищує залишок боргу")

        cash_register = _get_cash_register(session)
        balance_field_map = {
            Currency.UAH: "uah_balance",
            Currency.USD: "usd_balance",
            Currency.EUR: "eur_balance"
        }
        balance_field = balance_field_map[payload.currency]
        new_balance = getattr(cash_register, balance_field) + payload.amount
        setattr(cash_register, balance_field, new_balance)
        session.add(Transaction(
            currency=payload.currency,
            amount=payload.amount,
            transaction_type=TransactionType.ADD,
            user_id=current_user.id,
            description=f"Оплата боргу фермера #{contract_id}",
            uah_balance_after=cash_register.uah_balance,
            usd_balance_after=cash_register.usd_balance,
            eur_balance_after=cash_register.eur_balance
        ))
        session.add(cash_register)

        payment = FarmerContractPayment(
            contract_id=contract_id,
            payment_type=payload.payment_type.value if hasattr(payload.payment_type, 'value') else payload.payment_type,
            item_name="Грошова оплата",
            amount=payload.amount,
            currency=payload.currency,
            exchange_rate=payload.exchange_rate,
            amount_uah=amount_uah,
            created_by_user_id=current_user.id
        )
        session.add(payment)
        contract.balance_uah = max(0.0, contract.balance_uah - amount_uah)

    # ─── GRAIN: фермер платить зерном з балансу (зменшує борг) ───
    elif payload.payment_type == FarmerContractPaymentType.GRAIN:
        if not payload.culture_id or not payload.quantity_kg or payload.quantity_kg <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Вкажіть культуру та кількість")
        culture = session.get(GrainCulture, payload.culture_id)
        if not culture:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Культуру не знайдено")
        available = _get_farmer_balance(session, contract.owner_id, payload.culture_id)
        if payload.quantity_kg > available + 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недостатньо зерна на балансі. Доступно: {available:.2f}"
            )

        amount_uah = payload.quantity_kg * culture.price_per_kg
        if amount_uah > contract.balance_uah + 0.01:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сума перевищує залишок боргу")

        stock = _get_or_create_grain_stock(session, payload.culture_id)
        stock.farmer_quantity_kg -= payload.quantity_kg
        stock.own_quantity_kg += payload.quantity_kg
        session.add(stock)

        payment = FarmerContractPayment(
            contract_id=contract_id,
            payment_type=payload.payment_type.value if hasattr(payload.payment_type, 'value') else payload.payment_type,
            item_name=culture.name,
            amount=0.0,
            currency=Currency.UAH,
            amount_uah=amount_uah,
            culture_id=payload.culture_id,
            quantity_kg=payload.quantity_kg,
            created_by_user_id=current_user.id
        )
        session.add(payment)
        session.flush()
        session.add(FarmerGrainDeduction(
            owner_id=contract.owner_id,
            culture_id=payload.culture_id,
            quantity_kg=payload.quantity_kg,
            payment_id=payment.id
        ))
        contract.balance_uah = max(0.0, contract.balance_uah - amount_uah)

    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Невідомий тип операції")

    # Перевіряємо чи контракт повністю виконаний
    _check_contract_completion(session, contract)
    session.add(contract)

    session.commit()
    session.refresh(payment)
    return payment


@router.post("/payments/{payment_id}/cancel", response_model=FarmerContractPaymentResponse)
async def cancel_farmer_contract_payment(
    payment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Скасування операції по контракту фермера з поверненням"""
    payment = session.get(FarmerContractPayment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Операцію не знайдено")

    if payment.is_cancelled:
        raise HTTPException(status_code=400, detail="Операцію вже було скасовано")

    contract = session.get(FarmerContract, payment.contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Контракт не знайдено")

    owner = session.get(GrainOwner, contract.owner_id)

    # ─── GOODS_ISSUE: ми видавали товар фермеру → повертаємо на склад ───
    if payment.payment_type == FarmerContractPaymentType.GOODS_ISSUE.value:
        item = session.get(FarmerContractItem, payment.contract_item_id) if payment.contract_item_id else None
        qty = payment.quantity_kg or 0.0

        if item and qty > 0:
            item.delivered_kg = max(0.0, item.delivered_kg - qty)
            session.add(item)

            if item.item_type == FarmerContractItemType.GRAIN.value and item.culture_id:
                stock = _get_or_create_grain_stock(session, item.culture_id)
                stock.own_quantity_kg += qty
                stock.quantity_kg += qty
                stock.reserved_kg += qty
                session.add(stock)
            elif item.item_type == FarmerContractItemType.PURCHASE.value and item.purchase_stock_id:
                pstock = session.get(PurchaseStock, item.purchase_stock_id)
                if pstock:
                    pstock.quantity_kg += qty
                    pstock.reserved_kg += qty
                    session.add(pstock)
            elif item.item_type == FarmerContractItemType.CASH.value:
                cash_register = _get_cash_register(session)
                cash_register.uah_balance += qty
                session.add(cash_register)
                session.add(Transaction(
                    currency=Currency.UAH,
                    amount=qty,
                    transaction_type=TransactionType.ADD,
                    user_id=current_user.id,
                    description=f"Скасування видачі за контрактом #{contract.id} ({owner.full_name if owner else '?'})",
                    uah_balance_after=cash_register.uah_balance,
                    usd_balance_after=cash_register.usd_balance,
                    eur_balance_after=cash_register.eur_balance
                ))

    # ─── GOODS_RECEIVE: фермер передавав товар нам → повертаємо фермеру ───
    elif payment.payment_type == FarmerContractPaymentType.GOODS_RECEIVE.value:
        item = session.get(FarmerContractItem, payment.contract_item_id) if payment.contract_item_id else None
        qty = payment.quantity_kg or 0.0

        if item and qty > 0:
            item.delivered_kg = max(0.0, item.delivered_kg - qty)
            session.add(item)

            if item.item_type == FarmerContractItemType.GRAIN.value and item.culture_id:
                stock = _get_or_create_grain_stock(session, item.culture_id)
                stock.own_quantity_kg = max(0.0, stock.own_quantity_kg - qty)
                stock.farmer_quantity_kg += qty
                session.add(stock)

                # Видаляємо списання з балансу фермера
                deduction = session.exec(
                    select(FarmerGrainDeduction).where(
                        FarmerGrainDeduction.payment_id == payment.id
                    )
                ).first()
                if deduction:
                    session.delete(deduction)

            elif item.item_type == FarmerContractItemType.CASH.value:
                cash_register = _get_cash_register(session)
                cash_register.uah_balance = max(0.0, cash_register.uah_balance - qty)
                session.add(cash_register)
                session.add(Transaction(
                    currency=Currency.UAH,
                    amount=qty,
                    transaction_type=TransactionType.SUBTRACT,
                    user_id=current_user.id,
                    description=f"Скасування прийому за контрактом #{contract.id} ({owner.full_name if owner else '?'})",
                    uah_balance_after=cash_register.uah_balance,
                    usd_balance_after=cash_register.usd_balance,
                    eur_balance_after=cash_register.eur_balance
                ))

    # ─── CASH: фермер платив грошима → повертаємо з каси ───
    elif payment.payment_type == FarmerContractPaymentType.CASH.value:
        if payment.amount and payment.amount > 0:
            cash_register = _get_cash_register(session)
            currency_str = payment.currency.value if hasattr(payment.currency, 'value') else (payment.currency or "UAH")
            balance_field_map = {"UAH": "uah_balance", "USD": "usd_balance", "EUR": "eur_balance"}
            balance_field = balance_field_map.get(currency_str, "uah_balance")

            current_balance = getattr(cash_register, balance_field)
            setattr(cash_register, balance_field, max(0.0, current_balance - payment.amount))
            session.add(cash_register)

            try:
                currency_enum = Currency(currency_str)
            except ValueError:
                currency_enum = Currency.UAH

            session.add(Transaction(
                currency=currency_enum,
                amount=payment.amount,
                transaction_type=TransactionType.SUBTRACT,
                user_id=current_user.id,
                description=f"Скасування оплати боргу фермера #{contract.id} ({owner.full_name if owner else '?'})",
                uah_balance_after=cash_register.uah_balance,
                usd_balance_after=cash_register.usd_balance,
                eur_balance_after=cash_register.eur_balance
            ))

        # Повертаємо борг
        contract.balance_uah += payment.amount_uah
        session.add(contract)

    # ─── GRAIN: фермер платив зерном → повертаємо зерно фермеру ───
    elif payment.payment_type == FarmerContractPaymentType.GRAIN.value:
        qty = payment.quantity_kg or 0.0

        if qty > 0 and payment.culture_id:
            stock = _get_or_create_grain_stock(session, payment.culture_id)
            stock.own_quantity_kg = max(0.0, stock.own_quantity_kg - qty)
            stock.farmer_quantity_kg += qty
            session.add(stock)

            # Видаляємо списання з балансу фермера
            deduction = session.exec(
                select(FarmerGrainDeduction).where(
                    FarmerGrainDeduction.payment_id == payment.id
                )
            ).first()
            if deduction:
                session.delete(deduction)

        # Повертаємо борг
        contract.balance_uah += payment.amount_uah
        session.add(contract)

    # ─── SETTLEMENT: авторозрахунок (контракт виплати) ───
    elif payment.payment_type == FarmerContractPaymentType.SETTLEMENT.value:
        raise HTTPException(status_code=400, detail="Неможливо скасувати авторозрахунок. Зверніться до адміністратора.")

    # Якщо контракт був закритий — відкриваємо назад
    if contract.status == FarmerContractStatus.CLOSED.value:
        contract.status = FarmerContractStatus.OPEN.value
        session.add(contract)

    payment.is_cancelled = True
    payment.updated_at = datetime.utcnow()
    session.add(payment)

    session.commit()
    session.refresh(payment)
    return payment

