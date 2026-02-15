from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from sqlalchemy import func
from typing import Optional
from datetime import datetime, date, time, timedelta
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side

from backend.database import get_session
from backend.models import (
    GrainCulture,
    VehicleType,
    Driver,
    GrainOwner,
    GrainStock,
    GrainIntake,
    GrainShipment,
    DriverStat,
    TransactionType,
    StockAdjustmentLog,
    StockAdjustmentType,
    FarmerGrainDeduction,
    User
)
from backend.schemas import (
    GrainCultureResponse,
    GrainCultureCreate,
    GrainCulturePriceUpdate,
    VehicleTypeResponse,
    DriverCreate,
    DriverResponse,
    DriverUpdate,
    GrainOwnerCreate,
    GrainOwnerResponse,
    GrainStockResponse,
    FarmerBalanceItem,
    GrainIntakeCreate,
    GrainIntakeResponse,
    GrainReserveRequest,
    GrainQualityUpdateRequest,
    GrainIntakeUpdateRequest,
    GrainShipmentCreate,
    GrainShipmentUpdate,
    GrainShipmentResponse,
    DriverStatResponse,
    StockAdjustRequest,
    StockAdjustmentResponse
)
from backend.auth import get_current_user, get_current_super_admin

router = APIRouter()


def _get_or_create_stock(session: Session, culture_id: int) -> GrainStock:
    stock = session.exec(
        select(GrainStock).where(GrainStock.culture_id == culture_id)
    ).first()
    if not stock:
        stock = GrainStock(
            culture_id=culture_id,
            quantity_kg=0.0,
            own_quantity_kg=0.0,
            farmer_quantity_kg=0.0,
            reserved_kg=0.0
        )
        session.add(stock)
        session.commit()
        session.refresh(stock)
    return stock


def _get_or_create_driver_stat(
    session: Session,
    driver_id: int,
    vehicle_type_id: int,
    culture_id: int,
    has_trailer: bool
) -> DriverStat:
    stat = session.exec(
        select(DriverStat).where(
            DriverStat.driver_id == driver_id,
            DriverStat.vehicle_type_id == vehicle_type_id,
            DriverStat.culture_id == culture_id,
            DriverStat.has_trailer == has_trailer
        )
    ).first()
    if not stat:
        stat = DriverStat(
            driver_id=driver_id,
            vehicle_type_id=vehicle_type_id,
            culture_id=culture_id,
            has_trailer=has_trailer,
            trips=0,
            total_net_weight_kg=0.0,
            total_accepted_weight_kg=0.0
        )
        session.add(stat)
        session.commit()
        session.refresh(stat)
    return stat


def _apply_stock_delta(
    session: Session,
    culture_id: int,
    delta_kg: float,
    is_own_grain: bool = False
) -> None:
    """Обновление склада с учетом разделения на наше и фермерское зерно"""
    stock = _get_or_create_stock(session, culture_id)
    stock.quantity_kg += delta_kg
    if is_own_grain:
        stock.own_quantity_kg += delta_kg
    else:
        stock.farmer_quantity_kg += delta_kg
    session.add(stock)
    session.commit()


def _apply_driver_stat_delta(
    session: Session,
    driver_id: int,
    vehicle_type_id: int,
    culture_id: int,
    has_trailer: bool,
    delta_trips: int,
    delta_net_kg: float,
    delta_accepted_kg: float
) -> None:
    stat = _get_or_create_driver_stat(
        session,
        driver_id=driver_id,
        vehicle_type_id=vehicle_type_id,
        culture_id=culture_id,
        has_trailer=has_trailer
    )
    stat.trips += delta_trips
    stat.total_net_weight_kg += delta_net_kg
    stat.total_accepted_weight_kg += delta_accepted_kg
    session.add(stat)
    session.commit()


@router.get("/cultures", response_model=list[GrainCultureResponse])
async def list_cultures(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Список культур"""
    return session.exec(select(GrainCulture).order_by(GrainCulture.name)).all()


@router.post("/cultures", response_model=GrainCultureResponse)
async def create_culture(
    payload: GrainCultureCreate,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_super_admin)
):
    """Створення культури (тільки супер адмін)"""
    existing = session.exec(
        select(GrainCulture).where(GrainCulture.name == payload.name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Така культура вже існує"
        )
    culture = GrainCulture(name=payload.name, price_per_kg=max(1.0, payload.price_per_kg))
    session.add(culture)
    session.commit()
    session.refresh(culture)
    return culture


@router.patch("/cultures/{culture_id}/price", response_model=GrainCultureResponse)
async def update_culture_price(
    culture_id: int,
    payload: GrainCulturePriceUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Оновлення ціни культури"""
    culture = session.get(GrainCulture, culture_id)
    if not culture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Культуру не знайдено"
        )
    culture.price_per_kg = max(1.0, payload.price_per_kg)
    session.add(culture)
    session.commit()
    session.refresh(culture)
    return culture


@router.get("/vehicle-types", response_model=list[VehicleTypeResponse])
async def list_vehicle_types(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Список типів транспорту"""
    return session.exec(select(VehicleType).order_by(VehicleType.name)).all()


@router.get("/drivers", response_model=list[DriverResponse])
async def list_drivers(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Список водіїв підприємства"""
    return session.exec(select(Driver).order_by(Driver.full_name)).all()


@router.post("/drivers", response_model=DriverResponse)
async def create_driver(
    payload: DriverCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Створення водія"""
    driver = Driver(full_name=payload.full_name, phone=payload.phone)
    session.add(driver)
    session.commit()
    session.refresh(driver)
    return driver


@router.patch("/drivers/{driver_id}", response_model=DriverResponse)
async def update_driver(
    driver_id: int,
    payload: DriverUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Оновлення водія"""
    driver = session.get(Driver, driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Водія не знайдено"
        )
    if payload.full_name is not None:
        cleaned_name = " ".join(payload.full_name.split()).strip()
        if not cleaned_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Вкажіть ПІБ водія"
            )
        driver.full_name = cleaned_name
    if payload.phone is not None:
        driver.phone = payload.phone.strip() or None
    if payload.is_active is not None:
        driver.is_active = payload.is_active

    session.add(driver)
    session.commit()
    session.refresh(driver)
    return driver


@router.delete("/drivers/{driver_id}", response_model=DriverResponse)
async def delete_driver(
    driver_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Деактивація водія"""
    driver = session.get(Driver, driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Водія не знайдено"
        )
    driver.is_active = False
    session.add(driver)
    session.commit()
    session.refresh(driver)
    return driver


@router.get("/owners", response_model=list[GrainOwnerResponse])
async def list_owners(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    q: Optional[str] = Query(None, description="Пошук за ПІБ")
):
    """Список власників зерна (пошук для автодоповнення)"""
    query = select(GrainOwner)
    if q:
        # Используем ilike для поиска без учета регистра
        query = query.where(GrainOwner.full_name.ilike(f"%{q}%"))
    return session.exec(query.order_by(GrainOwner.full_name)).all()


@router.get("/owners/{owner_id}/balance", response_model=list[FarmerBalanceItem])
async def get_owner_balance(
    owner_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Баланс фермера по культурах (не викуплене зерно)"""
    owner = session.get(GrainOwner, owner_id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Фермера не знайдено"
        )

    rows = session.exec(
        select(
            GrainCulture.id,
            GrainCulture.name,
            func.sum(GrainIntake.accepted_weight_kg)
        )
        .join(GrainIntake, GrainIntake.culture_id == GrainCulture.id)
        .where(
            GrainIntake.owner_id == owner_id,
            GrainIntake.is_own_grain == False,
            GrainIntake.pending_quality == False
        )
        .group_by(GrainCulture.id, GrainCulture.name)
        .having(func.sum(GrainIntake.accepted_weight_kg) > 0)
        .order_by(GrainCulture.name)
    ).all()

    deductions = session.exec(
        select(
            FarmerGrainDeduction.culture_id,
            func.sum(FarmerGrainDeduction.quantity_kg)
        )
        .where(FarmerGrainDeduction.owner_id == owner_id)
        .group_by(FarmerGrainDeduction.culture_id)
    ).all()
    deduction_map = {row[0]: float(row[1] or 0) for row in deductions}

    result = []
    for row in rows:
        culture_id = row[0]
        total = float(row[2] or 0)
        total -= deduction_map.get(culture_id, 0.0)
        if total <= 0:
            continue
        result.append(
            FarmerBalanceItem(
                culture_id=culture_id,
                culture_name=row[1],
                quantity_kg=total
            )
        )
    return result


@router.get("/owners/{owner_id}/balance/export")
async def export_owner_balance(
    owner_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Експорт балансу фермера по культурах у Excel"""
    owner = session.get(GrainOwner, owner_id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Фермера не знайдено"
        )

    rows = session.exec(
        select(
            GrainCulture.id,
            GrainCulture.name,
            func.sum(GrainIntake.accepted_weight_kg)
        )
        .join(GrainIntake, GrainIntake.culture_id == GrainCulture.id)
        .where(
            GrainIntake.owner_id == owner_id,
            GrainIntake.is_own_grain == False,
            GrainIntake.pending_quality == False
        )
        .group_by(GrainCulture.id, GrainCulture.name)
        .having(func.sum(GrainIntake.accepted_weight_kg) > 0)
        .order_by(GrainCulture.name)
    ).all()

    deductions = session.exec(
        select(
            FarmerGrainDeduction.culture_id,
            func.sum(FarmerGrainDeduction.quantity_kg)
        )
        .where(FarmerGrainDeduction.owner_id == owner_id)
        .group_by(FarmerGrainDeduction.culture_id)
    ).all()
    deduction_map = {row[0]: float(row[1] or 0) for row in deductions}

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Баланс фермера"

    headers = ["Фермер", "Культура", "Не викуплено, кг"]
    sheet.append(headers)

    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB")
    )

    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    alt_fill = PatternFill("solid", fgColor="F8FAFC")

    for culture_id, culture_name, quantity in rows:
        quantity = float(quantity or 0) - deduction_map.get(culture_id, 0.0)
        if quantity <= 0:
            continue
        sheet.append([
            owner.full_name,
            culture_name,
            quantity
        ])

    for row in range(2, sheet.max_row + 1):
        row_fill = alt_fill if row % 2 == 0 else None
        for col in range(1, len(headers) + 1):
            cell = sheet.cell(row=row, column=col)
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border
            if col == 3:
                cell.number_format = "#,##0.00"

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:C{sheet.max_row}"
    sheet.column_dimensions["A"].width = 28
    sheet.column_dimensions["B"].width = 20
    sheet.column_dimensions["C"].width = 18

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    filename = f"farmer_balance_{owner_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/owners", response_model=GrainOwnerResponse)
async def create_owner(
    payload: GrainOwnerCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Створення власника"""
    owner = GrainOwner(full_name=payload.full_name, phone=payload.phone)
    session.add(owner)
    session.commit()
    session.refresh(owner)
    return owner


@router.get("/owners/export")
async def export_owners(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None, description="Пошук за ПІБ")
):
    """Експорт списку фермерів у Excel"""
    query = select(GrainOwner).order_by(GrainOwner.full_name)
    if search:
        query = query.where(GrainOwner.full_name.ilike(f"%{search}%"))

    owners = session.exec(query).all()

    # Підрахувати кількість приходів та загальну вагу для кожного фермера
    intakes = session.exec(select(GrainIntake).where(GrainIntake.is_own_grain == False)).all()
    culture_map = {c.id: c.name for c in session.exec(select(GrainCulture)).all()}

    owner_stats: dict[int, dict] = {}
    for intake in intakes:
        if intake.owner_id not in owner_stats:
            owner_stats[intake.owner_id] = {"count": 0, "total_kg": 0.0}
        owner_stats[intake.owner_id]["count"] += 1
        owner_stats[intake.owner_id]["total_kg"] += intake.accepted_weight_kg or intake.net_weight_kg or 0

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Фермери"

    headers = ["ID", "ПІБ", "Телефон", "Кількість приходів", "Загальна вага, кг"]
    sheet.append(headers)

    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB")
    )

    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    alt_fill = PatternFill("solid", fgColor="F8FAFC")

    for owner in owners:
        stats = owner_stats.get(owner.id, {"count": 0, "total_kg": 0.0})
        sheet.append([
            owner.id,
            owner.full_name,
            owner.phone or "-",
            stats["count"],
            round(stats["total_kg"], 2)
        ])

    for row in range(2, sheet.max_row + 1):
        row_fill = alt_fill if row % 2 == 0 else None
        for col in range(1, len(headers) + 1):
            cell = sheet.cell(row=row, column=col)
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border
            if col == 5:
                cell.number_format = "#,##0.00"

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:E{sheet.max_row}"

    column_widths = [8, 30, 18, 20, 20]
    for idx, width in enumerate(column_widths, start=1):
        col_letter = chr(64 + idx)
        sheet.column_dimensions[col_letter].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    filename = f"farmers_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/owners/intakes/export")
async def export_owner_intakes(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    owner_id: Optional[int] = Query(None, description="Фільтр за фермером"),
    culture_id: Optional[int] = Query(None, description="Фільтр за культурою"),
    start_date: Optional[str] = Query(None, description="Дата початку (ISO)"),
    end_date: Optional[str] = Query(None, description="Дата завершення (ISO)"),
    period: Optional[str] = Query(None, description="Період: today|week|month")
):
    """Експорт приходів фермерів у Excel"""
    query = select(GrainIntake).where(
        GrainIntake.is_own_grain == False
    ).order_by(GrainIntake.created_at.desc())

    if owner_id:
        query = query.where(GrainIntake.owner_id == owner_id)
    if culture_id:
        query = query.where(GrainIntake.culture_id == culture_id)

    if start_date:
        try:
            start_dt = datetime.combine(date.fromisoformat(start_date), time.min)
            query = query.where(GrainIntake.created_at >= start_dt)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некоректний формат дати початку")

    if end_date:
        try:
            end_dt = datetime.combine(date.fromisoformat(end_date), time.max)
            query = query.where(GrainIntake.created_at <= end_dt)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некоректний формат дати завершення")

    if period:
        now = datetime.utcnow()
        if period == "today":
            start_dt = datetime.combine(now.date(), time.min)
            query = query.where(GrainIntake.created_at >= start_dt)
        elif period == "week":
            start_dt = datetime.combine(now.date(), time.min) - timedelta(days=7)
            query = query.where(GrainIntake.created_at >= start_dt)
        elif period == "month":
            start_dt = datetime.combine(now.date(), time.min) - timedelta(days=30)
            query = query.where(GrainIntake.created_at >= start_dt)

    intakes = session.exec(query).all()

    culture_map = {c.id: c.name for c in session.exec(select(GrainCulture)).all()}

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Приходи фермерів"

    headers = ["Дата", "Фермер", "Телефон", "Культура", "Брутто, кг", "Тара, кг", "Нетто, кг", "Втрати, %", "Прийнято, кг", "Примітка"]
    sheet.append(headers)

    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB")
    )

    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    alt_fill = PatternFill("solid", fgColor="F8FAFC")

    for intake in intakes:
        culture_name = culture_map.get(intake.culture_id, "-")
        sheet.append([
            intake.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            intake.owner_full_name or "-",
            intake.owner_phone or "-",
            culture_name,
            intake.gross_weight_kg,
            intake.tare_weight_kg,
            intake.net_weight_kg,
            intake.impurity_percent,
            intake.accepted_weight_kg if not intake.pending_quality else "",
            intake.note or ""
        ])

    for row in range(2, sheet.max_row + 1):
        row_fill = alt_fill if row % 2 == 0 else None
        for col in range(1, len(headers) + 1):
            cell = sheet.cell(row=row, column=col)
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border
            if col in (5, 6, 7, 9):
                cell.number_format = "#,##0.00"
            if col == 8:
                cell.number_format = "0.00"

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:J{sheet.max_row}"

    column_widths = [20, 28, 16, 16, 14, 14, 14, 12, 14, 30]
    for idx, width in enumerate(column_widths, start=1):
        col_letter = chr(64 + idx)
        sheet.column_dimensions[col_letter].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    filename = f"farmer_intakes_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/stock", response_model=list[GrainStockResponse])
async def get_stock(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Поточні залишки по культурах"""
    cultures = session.exec(select(GrainCulture)).all()
    stock_items = session.exec(select(GrainStock)).all()
    stock_map = {item.culture_id: item for item in stock_items}

    response: list[GrainStockResponse] = []
    for culture in cultures:
        stock = stock_map.get(culture.id)
        quantity = stock.quantity_kg if stock else 0.0
        own_quantity = stock.own_quantity_kg if stock else 0.0
        farmer_quantity = stock.farmer_quantity_kg if stock else 0.0
        reserved_quantity = stock.reserved_kg if stock else 0.0
        response.append(
            GrainStockResponse(
                culture_id=culture.id,
                culture_name=culture.name,
                quantity_kg=quantity,
                own_quantity_kg=own_quantity,
                farmer_quantity_kg=farmer_quantity,
                reserved_kg=reserved_quantity,
                price_per_kg=culture.price_per_kg
            )
        )
    return response


@router.patch("/stock/{culture_id}/adjust", response_model=GrainStockResponse)
async def adjust_stock(
    culture_id: int,
    payload: StockAdjustRequest,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_super_admin)
):
    """Ручне коригування складу зерна"""
    culture = session.get(GrainCulture, culture_id)
    if not culture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Культуру не знайдено"
        )

    stock = session.exec(
        select(GrainStock).where(GrainStock.culture_id == culture_id)
    ).first()
    if not stock:
        stock = GrainStock(
            culture_id=culture_id,
            quantity_kg=0.0,
            own_quantity_kg=0.0,
            farmer_quantity_kg=0.0
        )
        session.add(stock)
        session.flush()

    delta = payload.amount if payload.transaction_type == TransactionType.ADD else -payload.amount
    quantity_before = stock.quantity_kg
    new_quantity = quantity_before + delta
    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недостатньо залишку для списання"
        )

    # При корректировке пропорционально изменяем own и farmer
    if quantity_before > 0:
        own_ratio = stock.own_quantity_kg / quantity_before
        farmer_ratio = stock.farmer_quantity_kg / quantity_before
    else:
        # Если склад был пуст, корректировка идет в наше зерно
        own_ratio = 1.0
        farmer_ratio = 0.0
    
    stock.quantity_kg = new_quantity
    stock.own_quantity_kg = new_quantity * own_ratio
    stock.farmer_quantity_kg = new_quantity * farmer_ratio
    session.add(stock)
    session.add(
        StockAdjustmentLog(
            stock_type=StockAdjustmentType.GRAIN,
            culture_id=culture.id,
            purchase_stock_id=None,
            category=None,
            item_name=culture.name,
            transaction_type=payload.transaction_type,
            amount=payload.amount,
            quantity_before=quantity_before,
            quantity_after=new_quantity,
            user_id=current_admin.id,
            user_full_name=current_admin.full_name,
            source="manual"
        )
    )
    session.commit()
    session.refresh(stock)

    return GrainStockResponse(
        culture_id=culture.id,
        culture_name=culture.name,
        quantity_kg=stock.quantity_kg,
        own_quantity_kg=stock.own_quantity_kg,
        farmer_quantity_kg=stock.farmer_quantity_kg,
        reserved_kg=stock.reserved_kg,
        price_per_kg=culture.price_per_kg
    )


@router.post("/stock/{culture_id}/reserve", response_model=GrainStockResponse)
async def reserve_stock(
    culture_id: int,
    payload: GrainReserveRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Бронювання зерна на складі"""
    culture = session.get(GrainCulture, culture_id)
    if not culture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Культуру не знайдено")
    stock = _get_or_create_stock(session, culture_id)
    available = stock.own_quantity_kg - stock.reserved_kg
    if payload.quantity_kg > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недостатньо доступного зерна. Доступно: {available}"
        )
    stock.reserved_kg += payload.quantity_kg
    session.add(stock)
    session.commit()
    session.refresh(stock)
    return GrainStockResponse(
        culture_id=culture.id,
        culture_name=culture.name,
        quantity_kg=stock.quantity_kg,
        own_quantity_kg=stock.own_quantity_kg,
        farmer_quantity_kg=stock.farmer_quantity_kg,
        reserved_kg=stock.reserved_kg,
        price_per_kg=culture.price_per_kg
    )


@router.post("/stock/{culture_id}/reserve/release", response_model=GrainStockResponse)
async def release_stock_reserve(
    culture_id: int,
    payload: GrainReserveRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Зняття бронювання зерна на складі"""
    culture = session.get(GrainCulture, culture_id)
    if not culture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Культуру не знайдено")
    stock = _get_or_create_stock(session, culture_id)
    if payload.quantity_kg > stock.reserved_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недостатньо заброньованого зерна. Заброньовано: {stock.reserved_kg}"
        )
    stock.reserved_kg -= payload.quantity_kg
    session.add(stock)
    session.commit()
    session.refresh(stock)
    return GrainStockResponse(
        culture_id=culture.id,
        culture_name=culture.name,
        quantity_kg=stock.quantity_kg,
        own_quantity_kg=stock.own_quantity_kg,
        farmer_quantity_kg=stock.farmer_quantity_kg,
        reserved_kg=stock.reserved_kg,
        price_per_kg=culture.price_per_kg
    )


@router.get("/stock/adjustments", response_model=list[StockAdjustmentResponse])
async def list_grain_stock_adjustments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Журнал ручних коригувань складу зерна"""
    return session.exec(
        select(StockAdjustmentLog)
        .where(StockAdjustmentLog.stock_type == StockAdjustmentType.GRAIN)
        .order_by(StockAdjustmentLog.created_at.desc())
    ).all()


@router.get("/stock/adjustments/export")
async def export_stock_adjustments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    start_date: str | None = None,
    end_date: str | None = None,
    stock_type: str | None = None,
    culture_id: int | None = None,
    source: str | None = None
):
    """Експорт журналу ручних змін складу у Excel"""
    stock_types = []
    if stock_type:
        if stock_type == 'grain':
            stock_types = [StockAdjustmentType.GRAIN]
        elif stock_type == 'purchase':
            stock_types = [StockAdjustmentType.PURCHASE]
    else:
        stock_types = [StockAdjustmentType.GRAIN, StockAdjustmentType.PURCHASE]
    
    query = select(StockAdjustmentLog).where(
        StockAdjustmentLog.stock_type.in_(stock_types)
    ).order_by(StockAdjustmentLog.created_at.desc())

    if culture_id:
        query = query.where(StockAdjustmentLog.culture_id == culture_id)

    if source:
        if source == 'manual':
            query = query.where(StockAdjustmentLog.source.is_(None))
        elif source == 'shipment':
            query = query.where(StockAdjustmentLog.source == 'shipment')

    if start_date:
        try:
            start_dt = datetime.combine(date.fromisoformat(start_date), time.min)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некоректний формат дати початку"
            )
        query = query.where(StockAdjustmentLog.created_at >= start_dt)

    if end_date:
        try:
            end_dt = datetime.combine(date.fromisoformat(end_date), time.max)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некоректний формат дати завершення"
            )
        query = query.where(StockAdjustmentLog.created_at <= end_dt)

    logs = session.exec(query).all()

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Журнал змін"

    headers = [
        "Дата",
        "Тип",
        "Позиція",
        "Зміна, кг",
        "Стало, кг",
        "Користувач",
        "Примітка"
    ]
    sheet.append(headers)

    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB")
    )

    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    alt_fill = PatternFill("solid", fgColor="F8FAFC")
    category_map = {
        "fertilizer": "Добрива",
        "seed": "Посівне"
    }

    for log in logs:
        if log.stock_type == StockAdjustmentType.GRAIN:
            type_label = "Зерно"
        else:
            type_label = category_map.get(log.category, "Закупівлі")
        delta_value = log.amount if log.transaction_type == TransactionType.ADD else -log.amount
        note = ''
        if log.source == 'shipment':
            note = f"Відправка: {log.destination or '-'}"
        else:
            note = 'Ручне'
        sheet.append([
            log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            type_label,
            log.item_name,
            delta_value,
            log.quantity_after,
            log.user_full_name,
            note
        ])

    for row in range(2, sheet.max_row + 1):
        row_fill = alt_fill if row % 2 == 0 else None
        for col in range(1, len(headers) + 1):
            cell = sheet.cell(row=row, column=col)
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border
            if col == 4:
                cell.number_format = "+0.00;-0.00"
            if col == 5:
                cell.number_format = "#,##0.00"

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:G{sheet.max_row}"
    column_widths = [20, 14, 28, 14, 14, 22, 30]
    for idx, width in enumerate(column_widths, start=1):
        sheet.column_dimensions[chr(64 + idx)].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    filename = f"stock_adjustments_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/intakes", response_model=GrainIntakeResponse)
async def create_intake(
    payload: GrainIntakeCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Створення картки приходу"""
    culture = session.get(GrainCulture, payload.culture_id)
    if not culture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Культуру не знайдено"
        )

    vehicle_type = session.get(VehicleType, payload.vehicle_type_id)
    if not vehicle_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тип транспорту не знайдено"
        )

    if payload.is_own_grain:
        if payload.owner_id or payload.owner_full_name or payload.owner_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для зерна підприємства власник не вказується"
            )
        owner_id = None
        owner_full_name = None
        owner_phone = None
    else:
        owner_id = payload.owner_id
        owner_full_name = payload.owner_full_name
        owner_phone = payload.owner_phone

        if not owner_id and not owner_full_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Потрібно вказати власника"
            )

        if owner_id:
            owner = session.get(GrainOwner, owner_id)
            if not owner:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Власника не знайдено"
                )
        else:
            owner = session.exec(
                select(GrainOwner).where(
                    GrainOwner.full_name == owner_full_name,
                    GrainOwner.phone == owner_phone
                )
            ).first()
            if not owner:
                owner = GrainOwner(full_name=owner_full_name, phone=owner_phone)
                session.add(owner)
                session.commit()
                session.refresh(owner)
            owner_id = owner.id

        owner_full_name = owner.full_name
        owner_phone = owner.phone

    if payload.is_internal_driver:
        if not payload.driver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Потрібно вибрати водія підприємства"
            )
        driver = session.get(Driver, payload.driver_id)
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Водія не знайдено"
            )
        driver_id = driver.id
        external_driver_name = None
    else:
        if payload.driver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для стороннього водія ID не використовується"
            )
        driver_id = None
        external_driver_name = payload.external_driver_name or "Інший водій"

    net_weight = payload.gross_weight_kg - payload.tare_weight_kg
    if net_weight <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нетто має бути більше 0"
        )

    if payload.pending_quality:
        accepted_weight = 0.0
    else:
        accepted_weight = net_weight * (1 - payload.impurity_percent / 100)

    intake = GrainIntake(
        culture_id=payload.culture_id,
        vehicle_type_id=payload.vehicle_type_id,
        has_trailer=payload.has_trailer,
        is_own_grain=payload.is_own_grain,
        owner_id=owner_id,
        owner_full_name=owner_full_name,
        owner_phone=owner_phone,
        is_internal_driver=payload.is_internal_driver,
        driver_id=driver_id,
        external_driver_name=external_driver_name,
        gross_weight_kg=payload.gross_weight_kg,
        tare_weight_kg=payload.tare_weight_kg,
        net_weight_kg=net_weight,
        impurity_percent=payload.impurity_percent,
        pending_quality=payload.pending_quality,
        accepted_weight_kg=accepted_weight,
        note=payload.note,
        created_by_user_id=current_user.id
    )
    session.add(intake)
    session.commit()
    session.refresh(intake)

    if not payload.pending_quality:
        _apply_stock_delta(session, payload.culture_id, accepted_weight, payload.is_own_grain)
        if payload.is_internal_driver and driver_id:
            _apply_driver_stat_delta(
                session,
                driver_id=driver_id,
                vehicle_type_id=payload.vehicle_type_id,
                culture_id=payload.culture_id,
                has_trailer=payload.has_trailer,
                delta_trips=1,
                delta_net_kg=net_weight,
                delta_accepted_kg=accepted_weight
            )

    return intake


@router.get("/intakes", response_model=list[GrainIntakeResponse])
async def list_intakes(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    pending_only: bool = Query(False, description="Тільки очікуючі % втрат")
):
    """Список карток приходу"""
    query = select(GrainIntake).order_by(GrainIntake.created_at.desc())
    if pending_only:
        query = query.where(GrainIntake.pending_quality == True)
    return session.exec(query).all()


@router.get("/intakes/export")
async def export_intakes(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    start_date: str | None = None,
    end_date: str | None = None,
    culture_id: int | None = None,
    status_filter: str = Query("all", description="all|pending|confirmed"),
    driver_id: int | None = None,
    vehicle_type_id: int | None = None,
    internal_only: bool = Query(False, description="Тільки доставки наших водіїв")
):
    """Експорт карток приходу у Excel"""
    query = select(GrainIntake).order_by(GrainIntake.created_at.desc())

    if start_date:
        try:
            start_dt = datetime.combine(date.fromisoformat(start_date), time.min)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некоректний формат дати початку"
            )
        query = query.where(GrainIntake.created_at >= start_dt)

    if end_date:
        try:
            end_dt = datetime.combine(date.fromisoformat(end_date), time.max)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некоректний формат дати завершення"
            )
        query = query.where(GrainIntake.created_at <= end_dt)

    if culture_id:
        query = query.where(GrainIntake.culture_id == culture_id)

    if internal_only:
        query = query.where(GrainIntake.is_internal_driver == True)

    if driver_id:
        query = query.where(GrainIntake.driver_id == driver_id)

    if vehicle_type_id:
        query = query.where(GrainIntake.vehicle_type_id == vehicle_type_id)

    if status_filter == "pending":
        query = query.where(GrainIntake.pending_quality == True)
    elif status_filter == "confirmed":
        query = query.where(GrainIntake.pending_quality == False)
    elif status_filter != "all":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некоректний статус фільтра"
        )

    intakes = session.exec(query).all()

    culture_map = {
        item.id: item.name for item in session.exec(select(GrainCulture)).all()
    }
    vehicle_map = {
        item.id: item.name for item in session.exec(select(VehicleType)).all()
    }
    driver_items = session.exec(select(Driver)).all()
    driver_map = {item.id: item.full_name for item in driver_items}
    driver_phone_map = {item.id: item.phone for item in driver_items}

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Прихід зерна"

    headers = [
        "Дата",
        "Культура",
        "Транспорт",
        "Є причіп",
        "Зерно підприємства",
        "Власник",
        "Телефон власника",
        "Тип водія",
        "Водій",
        "Телефон водія",
        "Брутто, кг",
        "Тара, кг",
        "Нетто, кг",
        "Втрати, %",
        "Очікує %",
        "Прийнято, кг",
        "Примітка"
    ]
    sheet.append(headers)

    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB")
    )

    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    alt_fill = PatternFill("solid", fgColor="F8FAFC")
    pending_fill = PatternFill("solid", fgColor="FEF3C7")
    confirmed_fill = PatternFill("solid", fgColor="BBF7D0")

    for intake in intakes:
        culture_name = culture_map.get(intake.culture_id, "-")
        vehicle_name = vehicle_map.get(intake.vehicle_type_id, "-")
        owner_name = "Підприємство" if intake.is_own_grain else (intake.owner_full_name or "-")
        owner_phone = "-" if intake.is_own_grain else (intake.owner_phone or "-")
        driver_type = "Наш водій" if intake.is_internal_driver else "Інший водій"
        if intake.is_internal_driver:
            driver_name = driver_map.get(intake.driver_id, "-")
            driver_phone = driver_phone_map.get(intake.driver_id) or "-"
        else:
            driver_name = intake.external_driver_name or "Інший водій"
            driver_phone = "-"
        status_label = "Очікує %" if intake.pending_quality else "Підтверджено"

        sheet.append([
            intake.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            culture_name,
            vehicle_name,
            "Так" if intake.has_trailer else "Ні",
            "Так" if intake.is_own_grain else "Ні",
            owner_name,
            owner_phone,
            driver_type,
            driver_name,
            driver_phone,
            intake.gross_weight_kg,
            intake.tare_weight_kg,
            intake.net_weight_kg,
            intake.impurity_percent,
            status_label,
            "" if intake.pending_quality else intake.accepted_weight_kg,
            intake.note or ""
        ])

    for row in range(2, sheet.max_row + 1):
        row_fill = alt_fill if row % 2 == 0 else None
        status_value = sheet.cell(row=row, column=15).value
        status_fill = pending_fill if status_value == "Очікує %" else confirmed_fill

        for col in range(1, len(headers) + 1):
            cell = sheet.cell(row=row, column=col)
            if col == 15:
                cell.fill = status_fill
                cell.alignment = Alignment(horizontal="center")
            elif row_fill:
                cell.fill = row_fill
            cell.border = thin_border
            if col in (11, 12, 13, 16):
                cell.number_format = "#,##0.00"
            if col == 14:
                cell.number_format = "0.00"

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:Q{sheet.max_row}"

    column_widths = [20, 16, 16, 10, 18, 24, 16, 14, 22, 16, 14, 14, 14, 12, 14, 14, 30]
    for idx, width in enumerate(column_widths, start=1):
        sheet.column_dimensions[chr(64 + idx)].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    filename = f"intake_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/shipments", response_model=list[GrainShipmentResponse])
async def list_shipments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Список відправок зерна"""
    return session.exec(
        select(GrainShipment).order_by(GrainShipment.created_at.desc())
    ).all()


@router.post("/shipments", response_model=GrainShipmentResponse)
async def create_shipment(
    payload: GrainShipmentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Створення відправки зерна"""
    destination = " ".join(payload.destination.split()).strip()
    if not destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Вкажіть куди відправляємо"
        )
    culture = session.get(GrainCulture, payload.culture_id)
    if not culture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Культуру не знайдено"
        )
    stock = _get_or_create_stock(session, payload.culture_id)
    if stock.quantity_kg < payload.quantity_kg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недостатньо залишку для відправки"
        )
    quantity_before = stock.quantity_kg
    # При відправці списуємо спочатку фермерське зерно, потім наше
    # farmer_quantity_kg залишається незмінним - це просто лічильник боргу перед фермерами
    remaining = payload.quantity_kg
    if stock.farmer_quantity_kg > 0:
        farmer_deduct = min(remaining, stock.farmer_quantity_kg)
        # Не змінюємо farmer_quantity_kg - це лічильник боргу
        remaining -= farmer_deduct
    if remaining > 0:
        stock.own_quantity_kg -= remaining
    stock.quantity_kg -= payload.quantity_kg
    session.add(stock)

    shipment = GrainShipment(
        culture_id=payload.culture_id,
        destination=destination,
        quantity_kg=payload.quantity_kg,
        created_by_user_id=current_user.id
    )
    session.add(shipment)
    session.add(
        StockAdjustmentLog(
            stock_type=StockAdjustmentType.GRAIN,
            culture_id=payload.culture_id,
            purchase_stock_id=None,
            category=None,
            item_name=culture.name,
            transaction_type=TransactionType.SUBTRACT,
            amount=payload.quantity_kg,
            quantity_before=quantity_before,
            quantity_after=stock.quantity_kg,
            user_id=current_user.id,
            user_full_name=current_user.full_name,
            source="shipment",
            destination=destination
        )
    )
    session.commit()
    session.refresh(shipment)
    return shipment


@router.patch("/shipments/{shipment_id}", response_model=GrainShipmentResponse)
async def update_shipment(
    shipment_id: int,
    payload: GrainShipmentUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Оновлення відправки зерна"""
    shipment = session.get(GrainShipment, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Відправку не знайдено"
        )

    new_destination = payload.destination
    if new_destination is not None:
        new_destination = " ".join(new_destination.split()).strip()
        if not new_destination:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Вкажіть куди відправляємо"
            )

    new_culture_id = payload.culture_id or shipment.culture_id
    new_quantity = payload.quantity_kg or shipment.quantity_kg

    if payload.culture_id is not None:
        culture = session.get(GrainCulture, new_culture_id)
        if not culture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Культуру не знайдено"
            )

    if new_culture_id == shipment.culture_id:
        delta = new_quantity - shipment.quantity_kg
        if delta != 0:
            stock = _get_or_create_stock(session, new_culture_id)
            quantity_before = stock.quantity_kg
            if delta > 0:
                # Увеличиваем отправку - списываем сначала фермерское, потом наше
                # farmer_quantity_kg остается неизменным
                remaining = delta
                if stock.farmer_quantity_kg > 0:
                    farmer_deduct = min(remaining, stock.farmer_quantity_kg)
                    remaining -= farmer_deduct
                if remaining > 0:
                    stock.own_quantity_kg -= remaining
                stock.quantity_kg -= delta
                transaction_type = TransactionType.SUBTRACT
                amount = delta
            else:
                # Уменьшаем отправку - возвращаем только в наше зерно
                stock.own_quantity_kg += abs(delta)
                stock.quantity_kg += abs(delta)
                transaction_type = TransactionType.ADD
                amount = abs(delta)
            session.add(stock)
            session.add(
                StockAdjustmentLog(
                    stock_type=StockAdjustmentType.GRAIN,
                    culture_id=new_culture_id,
                    purchase_stock_id=None,
                    category=None,
                    item_name=session.get(GrainCulture, new_culture_id).name,
                    transaction_type=transaction_type,
                    amount=amount,
                    quantity_before=quantity_before,
                    quantity_after=stock.quantity_kg,
                    user_id=current_user.id,
                    user_full_name=current_user.full_name,
                    source="shipment",
                    destination=new_destination or shipment.destination
                )
            )
    else:
        # Изменение культуры - возвращаем в старую культуру, списываем из новой
        old_stock = _get_or_create_stock(session, shipment.culture_id)
        old_before = old_stock.quantity_kg
        # Возвращаем только в наше зерно (так как при отправке списывалось из нашего)
        old_stock.own_quantity_kg += shipment.quantity_kg
        old_stock.quantity_kg += shipment.quantity_kg
        session.add(old_stock)

        new_stock = _get_or_create_stock(session, new_culture_id)
        new_before = new_stock.quantity_kg
        # Списываем сначала фермерское, потом наше (farmer_quantity_kg остается неизменным)
        remaining = new_quantity
        if new_stock.farmer_quantity_kg > 0:
            farmer_deduct = min(remaining, new_stock.farmer_quantity_kg)
            remaining -= farmer_deduct
        if remaining > 0:
            new_stock.own_quantity_kg -= remaining
        new_stock.quantity_kg -= new_quantity
        session.add(new_stock)
        session.add(
            StockAdjustmentLog(
                stock_type=StockAdjustmentType.GRAIN,
                culture_id=shipment.culture_id,
                purchase_stock_id=None,
                category=None,
                item_name=session.get(GrainCulture, shipment.culture_id).name,
                transaction_type=TransactionType.ADD,
                amount=shipment.quantity_kg,
                quantity_before=old_before,
                quantity_after=old_stock.quantity_kg,
                user_id=current_user.id,
                user_full_name=current_user.full_name,
                source="shipment",
                destination=shipment.destination
            )
        )
        session.add(
            StockAdjustmentLog(
                stock_type=StockAdjustmentType.GRAIN,
                culture_id=new_culture_id,
                purchase_stock_id=None,
                category=None,
                item_name=session.get(GrainCulture, new_culture_id).name,
                transaction_type=TransactionType.SUBTRACT,
                amount=new_quantity,
                quantity_before=new_before,
                quantity_after=new_stock.quantity_kg,
                user_id=current_user.id,
                user_full_name=current_user.full_name,
                source="shipment",
                destination=new_destination or shipment.destination
            )
        )

    if new_destination is not None:
        shipment.destination = new_destination
    shipment.culture_id = new_culture_id
    shipment.quantity_kg = new_quantity

    session.add(shipment)
    session.commit()
    session.refresh(shipment)
    return shipment


@router.get("/shipments/export")
async def export_shipments(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    start_date: str | None = None,
    end_date: str | None = None
):
    """Експорт відправок зерна у Excel"""
    query = select(GrainShipment).order_by(GrainShipment.created_at.desc())

    if start_date:
        try:
            start_dt = datetime.combine(date.fromisoformat(start_date), time.min)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некоректний формат дати початку"
            )
        query = query.where(GrainShipment.created_at >= start_dt)

    if end_date:
        try:
            end_dt = datetime.combine(date.fromisoformat(end_date), time.max)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некоректний формат дати завершення"
            )
        query = query.where(GrainShipment.created_at <= end_dt)

    shipments = session.exec(query).all()
    culture_map = {
        item.id: item.name for item in session.exec(select(GrainCulture)).all()
    }
    user_map = {
        item.id: item.full_name for item in session.exec(select(User)).all()
    }

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Відправки"

    headers = ["Дата", "Куди", "Культура", "Кількість, кг", "Користувач"]
    sheet.append(headers)

    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB")
    )

    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    alt_fill = PatternFill("solid", fgColor="F8FAFC")

    for shipment in shipments:
        sheet.append([
            shipment.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            shipment.destination,
            culture_map.get(shipment.culture_id, "-"),
            shipment.quantity_kg,
            user_map.get(shipment.created_by_user_id, "-")
        ])

    for row in range(2, sheet.max_row + 1):
        row_fill = alt_fill if row % 2 == 0 else None
        for col in range(1, len(headers) + 1):
            cell = sheet.cell(row=row, column=col)
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border
            if col == 4:
                cell.number_format = "#,##0.00"

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:E{sheet.max_row}"

    column_widths = [20, 28, 18, 16, 22]
    for idx, width in enumerate(column_widths, start=1):
        sheet.column_dimensions[chr(64 + idx)].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    filename = f"shipments_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/stock/export")
async def export_grain_stock(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Експорт залишків зерна на складі у Excel"""
    cultures = session.exec(select(GrainCulture)).all()
    stock_items = session.exec(select(GrainStock)).all()
    stock_map = {item.culture_id: item for item in stock_items}

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Склад зерна"

    headers = ["Культура", "Всього, кг", "Не викуплене у фермерів, кг", "Заброньовано, кг", "Ціна, грн/кг"]
    sheet.append(headers)

    header_fill = PatternFill("solid", fgColor="1F2937")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="E5E7EB"),
        right=Side(style="thin", color="E5E7EB"),
        top=Side(style="thin", color="E5E7EB"),
        bottom=Side(style="thin", color="E5E7EB")
    )

    for col in range(1, len(headers) + 1):
        cell = sheet.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = thin_border

    for culture in cultures:
        stock = stock_map.get(culture.id)
        quantity = stock.quantity_kg if stock else 0.0
        farmer_qty = stock.farmer_quantity_kg if stock else 0.0
        reserved_qty = stock.reserved_kg if stock else 0.0
        sheet.append([culture.name, quantity, farmer_qty, reserved_qty, culture.price_per_kg])

    alt_fill = PatternFill("solid", fgColor="F8FAFC")
    for row in range(2, sheet.max_row + 1):
        row_fill = alt_fill if row % 2 == 0 else None
        for col in range(1, len(headers) + 1):
            cell = sheet.cell(row=row, column=col)
            if row_fill:
                cell.fill = row_fill
            cell.border = thin_border
            if col in (2, 3, 4, 5):
                cell.number_format = "#,##0.00"

    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:E{sheet.max_row}"
    sheet.column_dimensions["A"].width = 28
    sheet.column_dimensions["B"].width = 16
    sheet.column_dimensions["C"].width = 20
    sheet.column_dimensions["D"].width = 18
    sheet.column_dimensions["E"].width = 16

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)

    filename = f"grain_stock_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.patch("/intakes/{intake_id}/quality", response_model=GrainIntakeResponse)
async def update_intake_quality(
    intake_id: int,
    payload: GrainQualityUpdateRequest,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_super_admin)
):
    """Оновлення відсотку втрат і включення в статистику"""
    intake = session.get(GrainIntake, intake_id)
    if not intake:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Картку не знайдено"
        )

    new_accepted = intake.net_weight_kg * (1 - payload.impurity_percent / 100)
    old_accepted = intake.accepted_weight_kg
    was_pending = intake.pending_quality

    intake.impurity_percent = payload.impurity_percent
    intake.pending_quality = False
    intake.accepted_weight_kg = new_accepted
    session.add(intake)
    session.commit()
    session.refresh(intake)

    if was_pending:
        _apply_stock_delta(session, intake.culture_id, new_accepted, intake.is_own_grain)
        if intake.is_internal_driver and intake.driver_id:
            _apply_driver_stat_delta(
                session,
                driver_id=intake.driver_id,
                vehicle_type_id=intake.vehicle_type_id,
                culture_id=intake.culture_id,
                has_trailer=intake.has_trailer,
                delta_trips=1,
                delta_net_kg=intake.net_weight_kg,
                delta_accepted_kg=new_accepted
            )
    else:
        delta_accepted = new_accepted - old_accepted
        if abs(delta_accepted) > 0:
            _apply_stock_delta(session, intake.culture_id, delta_accepted, intake.is_own_grain)
            if intake.is_internal_driver and intake.driver_id:
                _apply_driver_stat_delta(
                    session,
                    driver_id=intake.driver_id,
                    vehicle_type_id=intake.vehicle_type_id,
                    culture_id=intake.culture_id,
                    has_trailer=intake.has_trailer,
                    delta_trips=0,
                    delta_net_kg=0.0,
                    delta_accepted_kg=delta_accepted
                )

    return intake


@router.patch("/intakes/{intake_id}", response_model=GrainIntakeResponse)
async def update_intake(
    intake_id: int,
    payload: GrainIntakeUpdateRequest,
    session: Session = Depends(get_session),
    current_admin: User = Depends(get_current_super_admin)
):
    """Оновлення картки приходу (тільки супер адмін)"""
    intake = session.get(GrainIntake, intake_id)
    if not intake:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Картку не знайдено"
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Зберігаємо старі значення для перерахунку
    old_culture_id = intake.culture_id
    old_vehicle_type_id = intake.vehicle_type_id
    old_has_trailer = intake.has_trailer
    old_is_internal_driver = intake.is_internal_driver
    old_driver_id = intake.driver_id
    old_pending = intake.pending_quality
    old_net = intake.net_weight_kg
    old_accepted = intake.accepted_weight_kg
    old_is_own_grain = intake.is_own_grain

    # Власник
    if update_data.get("is_own_grain") is True:
        update_data["owner_id"] = None
        update_data["owner_full_name"] = None
        update_data["owner_phone"] = None
    elif update_data.get("is_own_grain") is False:
        owner_id = update_data.get("owner_id", intake.owner_id)
        owner_full_name = update_data.get("owner_full_name", intake.owner_full_name)
        owner_phone = update_data.get("owner_phone", intake.owner_phone)
        if not owner_id and not owner_full_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Потрібно вказати власника"
            )
        if owner_id:
            owner = session.get(GrainOwner, owner_id)
            if not owner:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Власника не знайдено"
                )
            update_data["owner_full_name"] = owner.full_name
            update_data["owner_phone"] = owner.phone
        else:
            owner = session.exec(
                select(GrainOwner).where(
                    GrainOwner.full_name == owner_full_name,
                    GrainOwner.phone == owner_phone
                )
            ).first()
            if not owner:
                owner = GrainOwner(full_name=owner_full_name, phone=owner_phone)
                session.add(owner)
                session.commit()
                session.refresh(owner)
            update_data["owner_id"] = owner.id
            update_data["owner_full_name"] = owner.full_name
            update_data["owner_phone"] = owner.phone

    # Водій
    if update_data.get("is_internal_driver") is True:
        driver_id = update_data.get("driver_id", intake.driver_id)
        if not driver_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Потрібно вибрати водія підприємства"
            )
        driver = session.get(Driver, driver_id)
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Водія не знайдено"
            )
        update_data["external_driver_name"] = None
    elif update_data.get("is_internal_driver") is False:
        external_driver_name = update_data.get("external_driver_name", intake.external_driver_name)
        update_data["external_driver_name"] = external_driver_name or "Інший водій"
        update_data["driver_id"] = None

    # Перерахунок ваги
    gross = update_data.get("gross_weight_kg", intake.gross_weight_kg)
    tare = update_data.get("tare_weight_kg", intake.tare_weight_kg)
    pending = update_data.get("pending_quality", intake.pending_quality)
    impurity = update_data.get("impurity_percent", intake.impurity_percent)
    if gross is not None and tare is not None:
        net = gross - tare
        if net <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нетто має бути більше 0"
            )
        update_data["net_weight_kg"] = net
        if pending:
            update_data["accepted_weight_kg"] = 0.0
        else:
            update_data["accepted_weight_kg"] = net * (1 - impurity / 100)

    # Оновлюємо модель
    for field, value in update_data.items():
        setattr(intake, field, value)

    session.add(intake)
    session.commit()
    session.refresh(intake)

    # Коригуємо склад і статистику
    if not old_pending:
        _apply_stock_delta(session, old_culture_id, -old_accepted, old_is_own_grain)
        if old_is_internal_driver and old_driver_id:
            _apply_driver_stat_delta(
                session,
                driver_id=old_driver_id,
                vehicle_type_id=old_vehicle_type_id,
                culture_id=old_culture_id,
                has_trailer=old_has_trailer,
                delta_trips=-1,
                delta_net_kg=-old_net,
                delta_accepted_kg=-old_accepted
            )

    if not intake.pending_quality:
        _apply_stock_delta(session, intake.culture_id, intake.accepted_weight_kg, intake.is_own_grain)
        if intake.is_internal_driver and intake.driver_id:
            _apply_driver_stat_delta(
                session,
                driver_id=intake.driver_id,
                vehicle_type_id=intake.vehicle_type_id,
                culture_id=intake.culture_id,
                has_trailer=intake.has_trailer,
                delta_trips=1,
                delta_net_kg=intake.net_weight_kg,
                delta_accepted_kg=intake.accepted_weight_kg
            )

    return intake


@router.get("/drivers/{driver_id}/stats", response_model=list[DriverStatResponse])
async def get_driver_stats(
    driver_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Статистика по водію"""
    driver = session.get(Driver, driver_id)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Водія не знайдено"
        )

    stats = session.exec(
        select(DriverStat).where(DriverStat.driver_id == driver_id)
    ).all()

    vehicle_map = {
        v.id: v for v in session.exec(select(VehicleType)).all()
    }
    culture_map = {
        c.id: c for c in session.exec(select(GrainCulture)).all()
    }

    response: list[DriverStatResponse] = []
    for stat in stats:
        response.append(
            DriverStatResponse(
                driver_id=stat.driver_id,
                driver_name=driver.full_name,
                vehicle_type_id=stat.vehicle_type_id,
                vehicle_type_name=vehicle_map.get(stat.vehicle_type_id).name
                if vehicle_map.get(stat.vehicle_type_id)
                else "",
                culture_id=stat.culture_id,
                culture_name=culture_map.get(stat.culture_id).name
                if culture_map.get(stat.culture_id)
                else "",
                has_trailer=stat.has_trailer,
                trips=stat.trips,
                total_net_weight_kg=stat.total_net_weight_kg,
                total_accepted_weight_kg=stat.total_accepted_weight_kg
            )
        )

    return response

