from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum
from sqlalchemy import UniqueConstraint, Column, String


class UserRole(str, Enum):
    """Роли пользователей"""
    SUPER_ADMIN = "super_admin"
    USER = "user"


class BaseModel(SQLModel):
    """Базовая модель с общими полями"""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)


class User(BaseModel, table=True):
    """Модель пользователя"""
    __tablename__ = "users"
    
    username: str = Field(unique=True, index=True)
    password_hash: str = Field(description="Хеш пароля")
    password_plain: Optional[str] = Field(default=None, description="Пароль в открытом виде")
    full_name: str = Field(description="ФИО пользователя")
    role: UserRole = Field(default=UserRole.USER)
    is_active: bool = Field(default=True)


class Currency(str, Enum):
    """Валюты"""
    UAH = "UAH"  # Гривна
    USD = "USD"  # Доллары
    EUR = "EUR"  # Евро


class TransactionType(str, Enum):
    """Тип транзакции"""
    ADD = "add"  # Добавление
    SUBTRACT = "subtract"  # Вычитание


class StockAdjustmentType(str, Enum):
    """Тип складу для ручних коригувань"""
    GRAIN = "grain"
    PURCHASE = "purchase"


class CashRegister(BaseModel, table=True):
    """Модель кассы с балансами валют"""
    __tablename__ = "cash_register"
    
    uah_balance: float = Field(default=0.0, description="Баланс в гривнах")
    usd_balance: float = Field(default=0.0, description="Баланс в долларах")
    eur_balance: float = Field(default=0.0, description="Баланс в евро")


class Transaction(BaseModel, table=True):
    """Модель транзакции (история операций с кассой)"""
    __tablename__ = "transactions"
    
    currency: Currency = Field(description="Валюта операции")
    amount: float = Field(description="Сумма операции")
    transaction_type: TransactionType = Field(description="Тип операции (добавление/вычитание)")
    user_id: int = Field(foreign_key="users.id", description="ID пользователя, выполнившего операцию")
    description: Optional[str] = Field(default=None, description="Описание операции")
    
    # Балансы после операции (для истории)
    uah_balance_after: float = Field(description="Баланс UAH после операции")
    usd_balance_after: float = Field(description="Баланс USD после операции")
    eur_balance_after: float = Field(description="Баланс EUR после операции")


class GrainCulture(BaseModel, table=True):
    """Культура зерна"""
    __tablename__ = "grain_cultures"

    name: str = Field(unique=True, index=True, description="Назва культури")
    price_per_kg: float = Field(default=1.0, description="Ціна за кг")
    is_active: bool = Field(default=True)


class VehicleType(BaseModel, table=True):
    """Тип транспорту"""
    __tablename__ = "vehicle_types"

    name: str = Field(unique=True, index=True, description="Назва транспорту")
    is_active: bool = Field(default=True)


class Driver(BaseModel, table=True):
    """Водій підприємства"""
    __tablename__ = "drivers"

    full_name: str = Field(index=True, description="ПІБ водія")
    phone: Optional[str] = Field(default=None, description="Номер телефону")
    is_active: bool = Field(default=True)


class GrainOwner(BaseModel, table=True):
    """Власник зерна"""
    __tablename__ = "grain_owners"

    full_name: str = Field(index=True, description="ПІБ власника")
    phone: Optional[str] = Field(default=None, description="Номер телефону")


class GrainStock(BaseModel, table=True):
    """Залишки зерна на складі"""
    __tablename__ = "grain_stock"

    culture_id: int = Field(foreign_key="grain_cultures.id", unique=True)
    quantity_kg: float = Field(default=0.0, description="Кількість в кг (загальна)")
    own_quantity_kg: float = Field(default=0.0, description="Наше зерно, кг")
    farmer_quantity_kg: float = Field(default=0.0, description="Зерно фермерів (не викуплене), кг")
    reserved_kg: float = Field(default=0.0, description="Заброньовано, кг")


class GrainIntake(BaseModel, table=True):
    """Картка приходу зерна"""
    __tablename__ = "grain_intakes"

    culture_id: int = Field(foreign_key="grain_cultures.id")
    vehicle_type_id: int = Field(foreign_key="vehicle_types.id")

    is_own_grain: bool = Field(default=False, description="Зерно підприємства")
    owner_id: Optional[int] = Field(default=None, foreign_key="grain_owners.id")
    owner_full_name: Optional[str] = Field(default=None, description="ПІБ власника (знімок)")
    owner_phone: Optional[str] = Field(default=None, description="Телефон власника (знімок)")

    is_internal_driver: bool = Field(default=True, description="Наш водій")
    driver_id: Optional[int] = Field(default=None, foreign_key="drivers.id")
    external_driver_name: Optional[str] = Field(default=None, description="ПІБ стороннього водія")

    has_trailer: bool = Field(default=False, description="Є причіп")
    gross_weight_kg: float = Field(description="Брутто, кг")
    tare_weight_kg: float = Field(description="Тара, кг")
    net_weight_kg: float = Field(description="Нетто, кг")

    impurity_percent: float = Field(default=0.0, description="Відсоток втрат")
    pending_quality: bool = Field(default=False, description="Очікує % втрат")
    accepted_weight_kg: float = Field(default=0.0, description="Прийнята вага, кг")

    note: Optional[str] = Field(default=None, description="Примітка")
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")


class GrainShipment(BaseModel, table=True):
    """Картка відправки зерна"""
    __tablename__ = "grain_shipments"

    culture_id: int = Field(foreign_key="grain_cultures.id")
    destination: str = Field(description="Куди відправляємо")
    quantity_kg: float = Field(description="Кількість, кг")
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")


class DriverStat(BaseModel, table=True):
    """Статистика по водію"""
    __tablename__ = "driver_stats"
    __table_args__ = (
        UniqueConstraint(
            "driver_id",
            "vehicle_type_id",
            "culture_id",
            "has_trailer",
            name="uq_driver_stat_key"
        ),
    )

    driver_id: int = Field(foreign_key="drivers.id")
    vehicle_type_id: int = Field(foreign_key="vehicle_types.id")
    culture_id: int = Field(foreign_key="grain_cultures.id")
    has_trailer: bool = Field(default=False)

    trips: int = Field(default=0, description="Кількість ходок")
    total_net_weight_kg: float = Field(default=0.0, description="Всього нетто, кг")
    total_accepted_weight_kg: float = Field(default=0.0, description="Всього прийнято, кг")


class PurchaseCategory(str, Enum):
    """Категорія закупівель"""
    FERTILIZER = "fertilizer"
    SEED = "seed"


class PurchaseStock(BaseModel, table=True):
    """Склад закупівель (не зерно)"""
    __tablename__ = "purchase_stock"
    __table_args__ = (
        UniqueConstraint("normalized_name", "category", name="uq_purchase_stock_normalized"),
    )

    name: str = Field(index=True, description="Назва позиції")
    normalized_name: str = Field(index=True, description="Нормалізована назва")
    category: PurchaseCategory = Field(description="Категорія")
    quantity_kg: float = Field(default=0.0, description="Кількість в кг")
    reserved_kg: float = Field(default=0.0, description="Забронировано, кг")
    sale_price_per_kg: float = Field(default=1.0, description="Ціна продажу за кг")


class FarmerContractType(str, Enum):
    """Тип контракту з фермером"""
    PAYMENT = "payment"      # Виплата (одноразова)
    DEBT = "debt"            # Борговий
    EXCHANGE = "exchange"    # Обмін
    RESERVE = "reserve"      # Резерв


class FarmerContractStatus(str, Enum):
    """Статус контракту фермера"""
    PENDING = "pending"      # Очікує (резерв — чекаємо на склад)
    OPEN = "open"            # Відкритий (активний)
    CLOSED = "closed"        # Закритий (виконаний)
    CANCELLED = "cancelled"  # Скасований


class FarmerContractItemType(str, Enum):
    """Тип позиції у контракті фермера"""
    GRAIN = "grain"
    PURCHASE = "purchase"
    CASH = "cash"
    VOUCHER = "voucher"


class FarmerContractItemDirection(str, Enum):
    """Напрям позиції у контракті фермера"""
    FROM_FARMER = "from_farmer"
    FROM_COMPANY = "from_company"


class FarmerContractPaymentType(str, Enum):
    """Тип оплати контракту фермера"""
    CASH = "cash"                      # Грошова оплата від фермера
    GRAIN = "grain"                    # Оплата зерном від фермера
    GOODS_ISSUE = "goods_issue"        # Видача товару фермеру
    GOODS_RECEIVE = "goods_receive"    # Прийом товару від фермера
    SETTLEMENT = "settlement"          # Авторозрахунок (контракт виплати)
    VOUCHER = "voucher"                # Талон на зерно (хлібний завод)


class FarmerContract(BaseModel, table=True):
    """Контракт з фермером"""
    __tablename__ = "farmer_contracts"

    owner_id: int = Field(foreign_key="grain_owners.id")
    contract_type: str = Field(default="debt", sa_column=Column(String(32), default="debt"))
    status: str = Field(default="open", sa_column=Column(String(32), default="open"))
    total_value_uah: float = Field(default=0.0, description="Сума контракту, грн")
    balance_uah: float = Field(default=0.0, description="Залишок до оплати, грн")
    currency: Optional[str] = Field(default=None, description="Валюта виплати (для payment)")
    exchange_rate: Optional[float] = Field(default=None, description="Курс (для payment)")
    was_reserve: bool = Field(default=False, description="Був резервом")
    note: Optional[str] = Field(default=None, description="Примітка")
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")


class FarmerContractItem(BaseModel, table=True):
    """Позиція контракту фермера"""
    __tablename__ = "farmer_contract_items"

    contract_id: int = Field(foreign_key="farmer_contracts.id")
    direction: str = Field(default="from_company", sa_column=Column(String(32), default="from_company"))
    item_type: str = Field(default="grain", sa_column=Column(String(32), default="grain"))
    culture_id: Optional[int] = Field(default=None, foreign_key="grain_cultures.id")
    purchase_stock_id: Optional[int] = Field(default=None, foreign_key="purchase_stock.id")
    item_name: Optional[str] = Field(default=None, description="Назва позиції (знімок)")
    quantity_kg: float = Field(default=0.0, description="Кількість, кг")
    price_per_kg: float = Field(default=0.0, description="Ціна, грн/кг")
    total_value_uah: float = Field(default=0.0, description="Сума, грн")
    delivered_kg: float = Field(default=0.0, description="Фактично видано/отримано, кг")


class FarmerContractPayment(BaseModel, table=True):
    """Оплата контракту фермера"""
    __tablename__ = "farmer_contract_payments"

    contract_id: int = Field(foreign_key="farmer_contracts.id")
    contract_item_id: Optional[int] = Field(default=None, foreign_key="farmer_contract_items.id")
    payment_type: str = Field(default="cash", sa_column=Column(String(32), default="cash"))
    item_name: Optional[str] = Field(default=None, description="Назва позиції (знімок)")
    amount: float = Field(default=0.0, description="Сума")
    currency: Currency = Field(default=Currency.UAH)
    exchange_rate: Optional[float] = Field(default=None)
    amount_uah: float = Field(default=0.0, description="Сума в грн")
    culture_id: Optional[int] = Field(default=None, foreign_key="grain_cultures.id")
    quantity_kg: Optional[float] = Field(default=None, description="Кількість, кг")
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    is_cancelled: bool = Field(default=False)
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")


class FarmerGrainDeduction(BaseModel, table=True):
    """Списання зерна фермера у рахунок оплати"""
    __tablename__ = "farmer_grain_deductions"

    owner_id: int = Field(foreign_key="grain_owners.id")
    culture_id: int = Field(foreign_key="grain_cultures.id")
    quantity_kg: float = Field(description="Кількість, кг")
    payment_id: Optional[int] = Field(default=None, foreign_key="farmer_contract_payments.id")


class PurchaseRecord(BaseModel, table=True):
    """Закупівля (історія)"""
    __tablename__ = "purchase_records"

    stock_id: Optional[int] = Field(default=None, foreign_key="purchase_stock.id")
    item_name: str = Field(description="Назва позиції (знімок)")
    normalized_name: str = Field(description="Нормалізована назва")
    category: PurchaseCategory = Field(description="Категорія")
    price_per_kg: float = Field(description="Ціна за кг")
    currency: Currency = Field(description="Валюта закупівлі")
    quantity_kg: float = Field(description="Кількість, кг")
    total_amount: float = Field(description="Сума")
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")


class StockAdjustmentLog(BaseModel, table=True):
    """Журнал ручних коригувань складу"""
    __tablename__ = "stock_adjustments"

    stock_type: StockAdjustmentType = Field(description="Тип складу")
    culture_id: Optional[int] = Field(default=None, foreign_key="grain_cultures.id")
    purchase_stock_id: Optional[int] = Field(default=None, foreign_key="purchase_stock.id")
    category: Optional[PurchaseCategory] = Field(default=None, description="Категорія закупівель")
    item_name: str = Field(description="Назва позиції (знімок)")
    transaction_type: TransactionType = Field(description="Тип зміни")
    amount: float = Field(description="Кількість, кг")
    quantity_before: float = Field(description="Кількість до")
    quantity_after: float = Field(description="Кількість після")
    user_id: int = Field(foreign_key="users.id", description="ID користувача")
    user_full_name: str = Field(description="ПІБ користувача (знімок)")
    source: Optional[str] = Field(default=None, description="Джерело зміни")
    destination: Optional[str] = Field(default=None, description="Куди відправлено")


class Landlord(BaseModel, table=True):
    """Модель орендодавця"""
    __tablename__ = "landlords"

    full_name: str = Field(index=True, description="ПІБ орендодавця")
    phone: Optional[str] = Field(default=None, description="Телефон")


class LeaseContract(BaseModel, table=True):
    """Модель контракту оренди"""
    __tablename__ = "lease_contracts"

    landlord_id: int = Field(foreign_key="landlords.id", description="ID орендодавця")
    landlord_full_name: str = Field(description="ПІБ орендодавця (знімок)")
    field_name: str = Field(description="Назва поля")
    contract_date: datetime = Field(description="Дата укладення контракту")
    is_active: bool = Field(default=True, description="Активний контракт")
    note: Optional[str] = Field(default=None, description="Примітка")


class LeaseContractItem(BaseModel, table=True):
    """Позиція контракту оренди (культура, кількість, ціна)"""
    __tablename__ = "lease_contract_items"

    contract_id: int = Field(foreign_key="lease_contracts.id", description="ID контракту")
    culture_id: int = Field(foreign_key="grain_cultures.id", description="Культура для оплати")
    quantity_kg: float = Field(gt=0, description="Кількість зерна за рік, кг")
    price_per_kg_uah: float = Field(gt=0, description="Курс гривні за кг зерна")


class LeasePayment(BaseModel, table=True):
    """Модель виплати по контракту оренди"""
    __tablename__ = "lease_payments"

    contract_id: int = Field(foreign_key="lease_contracts.id", description="ID контракту")
    payment_type: str = Field(description="Тип виплати: 'grain' або 'cash'")
    # Для виплати грошима
    currency: Optional[str] = Field(default=None, description="Валюта (якщо виплата грошима)")
    amount: Optional[float] = Field(default=None, description="Сума (якщо виплата грошима)")
    # Загальні поля
    payment_date: datetime = Field(description="Дата виплати")
    note: Optional[str] = Field(default=None, description="Примітка")
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    is_cancelled: bool = Field(default=False, description="Чи скасована виплата")


class LeasePaymentGrainItem(BaseModel, table=True):
    """Позиція виплати зерном (може бути кілька культур)"""
    __tablename__ = "lease_payment_grain_items"

    payment_id: int = Field(foreign_key="lease_payments.id", description="ID виплати")
    culture_id: int = Field(foreign_key="grain_cultures.id", description="Культура")
    quantity_kg: float = Field(description="Кількість зерна, кг")


class GrainVoucher(BaseModel, table=True):
    """Талон на зерно (хлібний завод)"""
    __tablename__ = "grain_vouchers"

    farmer_contract_id: int = Field(foreign_key="farmer_contracts.id", description="Контракт фермера")
    farmer_contract_payment_id: Optional[int] = Field(default=None, foreign_key="farmer_contract_payments.id", description="Оплата контракту")
    owner_id: int = Field(foreign_key="grain_owners.id", description="Фермер")
    culture_id: int = Field(foreign_key="grain_cultures.id", description="Культура (пшениця)")
    quantity_kg: float = Field(description="Кількість зерна по талону, кг")
    price_per_kg: float = Field(default=0.0, description="Ціна за кг на момент створення")
    total_value_uah: float = Field(default=0.0, description="Загальна сума талону, грн")
    paid_value_uah: float = Field(default=0.0, description="Вже сплачено, грн")
    remaining_value_uah: float = Field(default=0.0, description="Залишок до сплати, грн")
    is_closed: bool = Field(default=False, description="Талон повністю сплачено")
    note: Optional[str] = Field(default=None, description="Примітка")
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")


class GrainVoucherPayment(BaseModel, table=True):
    """Виплата по талону на зерно"""
    __tablename__ = "grain_voucher_payments"

    voucher_id: int = Field(foreign_key="grain_vouchers.id", description="ID талону")
    currency: Currency = Field(default=Currency.UAH, description="Валюта виплати")
    amount: float = Field(description="Сума у валюті виплати")
    exchange_rate: float = Field(default=1.0, description="Курс до гривні")
    amount_uah: float = Field(description="Сума в гривнях")
    description: Optional[str] = Field(default=None, description="Примітка")
    is_cancelled: bool = Field(default=False, description="Скасовано")
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")

