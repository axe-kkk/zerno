from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from backend.models import UserRole, Currency, TransactionType, PurchaseCategory, StockAdjustmentType, FarmerContractType, FarmerContractStatus, FarmerContractItemType, FarmerContractPaymentType, FarmerContractItemDirection


# Схемы для аутентификации

class LoginRequest(BaseModel):
    """Схема для входу"""
    username: str = Field(..., description="Ім'я користувача")
    password: str = Field(..., description="Пароль")


class TokenResponse(BaseModel):
    """Схема ответа с токеном"""
    access_token: str
    token_type: str = "bearer"


# Схемы для пользователей

class UserCreate(BaseModel):
    """Схема для створення користувача (тільки для адміна)"""
    username: str = Field(..., min_length=3, description="Ім'я користувача")
    password: str = Field(..., min_length=6, description="Пароль")
    full_name: str = Field(..., description="ПІБ користувача")


class UserResponse(BaseModel):
    """Схема ответа с данными пользователя"""
    id: int
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    password_plain: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Схема для обновления пользователя"""
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None


# Схемы для кассы

class CashRegisterResponse(BaseModel):
    """Схема ответа с балансами кассы"""
    id: int
    uah_balance: float
    usd_balance: float
    eur_balance: float
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class BalanceUpdateRequest(BaseModel):
    """Схема для зміни балансу"""
    currency: Currency = Field(..., description="Валюта")
    amount: float = Field(..., gt=0, description="Сума (має бути більше 0)")
    transaction_type: TransactionType = Field(..., description="Тип операції: add (додати) або subtract (відняти)")
    description: Optional[str] = Field(None, description="Опис операції")


class TransactionResponse(BaseModel):
    """Схема ответа с транзакцией"""
    id: int
    currency: Currency
    amount: float
    transaction_type: TransactionType
    user_id: int
    user_full_name: Optional[str] = None
    description: Optional[str]
    uah_balance_after: float
    usd_balance_after: float
    eur_balance_after: float
    created_at: datetime
    
    class Config:
        from_attributes = True


# Схемы для зерна и склада

class GrainCultureResponse(BaseModel):
    """Схема відповіді для культури"""
    id: int
    name: str
    price_per_kg: float
    is_active: bool
    
    class Config:
        from_attributes = True


class GrainCultureCreate(BaseModel):
    """Схема створення культури"""
    name: str = Field(..., description="Назва культури")
    price_per_kg: float = Field(0.0, ge=0, description="Ціна за кг")


class GrainCulturePriceUpdate(BaseModel):
    """Схема оновлення ціни"""
    price_per_kg: float = Field(..., ge=0, description="Нова ціна за кг")


class VehicleTypeResponse(BaseModel):
    """Схема відповіді для типу транспорту"""
    id: int
    name: str
    is_active: bool
    
    class Config:
        from_attributes = True


class DriverCreate(BaseModel):
    """Схема створення водія"""
    full_name: str = Field(..., description="ПІБ водія")
    phone: Optional[str] = Field(None, description="Номер телефону")


class DriverResponse(BaseModel):
    """Схема відповіді для водія"""
    id: int
    full_name: str
    phone: Optional[str]
    is_active: bool
    
    class Config:
        from_attributes = True


class DriverUpdate(BaseModel):
    """Схема оновлення водія"""
    full_name: Optional[str] = Field(None, description="ПІБ водія")
    phone: Optional[str] = Field(None, description="Номер телефону")
    is_active: Optional[bool] = Field(None, description="Активний")


class GrainOwnerCreate(BaseModel):
    """Схема створення власника зерна"""
    full_name: str = Field(..., description="ПІБ власника")
    phone: Optional[str] = Field(None, description="Номер телефону")


class GrainOwnerResponse(BaseModel):
    """Схема відповіді для власника"""
    id: int
    full_name: str
    phone: Optional[str]
    
    class Config:
        from_attributes = True


class GrainStockResponse(BaseModel):
    """Схема відповіді для складу"""
    culture_id: int
    culture_name: str
    quantity_kg: float
    own_quantity_kg: float
    farmer_quantity_kg: float
    reserved_kg: float
    price_per_kg: float


class FarmerBalanceItem(BaseModel):
    """Схема відповіді для балансу фермера по культурах"""
    culture_id: int
    culture_name: str
    quantity_kg: float


class FarmerContractItemCreate(BaseModel):
    direction: FarmerContractItemDirection
    item_type: FarmerContractItemType
    culture_id: Optional[int] = None
    purchase_stock_id: Optional[int] = None
    item_name: Optional[str] = None  # для резерву — назва позиції (може бути нова)
    quantity_kg: float
    price_per_kg: float


class FarmerContractCreate(BaseModel):
    owner_id: int
    contract_type: FarmerContractType = FarmerContractType.DEBT
    note: Optional[str] = None
    currency: Optional[str] = None        # для payment
    exchange_rate: Optional[float] = None  # для payment
    farmer_items: list[FarmerContractItemCreate] = []
    company_items: list[FarmerContractItemCreate] = []


class FarmerContractItemResponse(BaseModel):
    id: int
    direction: FarmerContractItemDirection
    item_type: FarmerContractItemType
    culture_id: Optional[int]
    purchase_stock_id: Optional[int]
    item_name: Optional[str]
    quantity_kg: float
    price_per_kg: float
    total_value_uah: float
    delivered_kg: float = 0.0

    class Config:
        from_attributes = True


class FarmerContractResponse(BaseModel):
    id: int
    owner_id: int
    contract_type: FarmerContractType
    status: FarmerContractStatus
    total_value_uah: float
    balance_uah: float
    currency: Optional[str] = None
    exchange_rate: Optional[float] = None
    was_reserve: bool = False
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FarmerContractDetailResponse(FarmerContractResponse):
    items: list[FarmerContractItemResponse]


class FarmerContractPaymentCreate(BaseModel):
    payment_type: FarmerContractPaymentType
    contract_item_id: Optional[int] = None       # for goods_issue / goods_receive
    amount: Optional[float] = None
    currency: Currency = Currency.UAH
    exchange_rate: Optional[float] = None
    culture_id: Optional[int] = None
    quantity_kg: Optional[float] = None


class FarmerContractPaymentResponse(BaseModel):
    id: int
    contract_id: int
    contract_item_id: Optional[int] = None
    payment_type: FarmerContractPaymentType
    item_name: Optional[str] = None
    amount: float
    currency: Currency
    exchange_rate: Optional[float]
    amount_uah: float
    culture_id: Optional[int]
    quantity_kg: Optional[float]
    payment_date: datetime
    is_cancelled: bool

    class Config:
        from_attributes = True


class GrainIntakeCreate(BaseModel):
    """Схема створення картки приходу"""
    culture_id: int = Field(..., description="Культура")
    vehicle_type_id: int = Field(..., description="Тип транспорту")
    has_trailer: bool = Field(False, description="Є причіп")
    
    is_own_grain: bool = Field(False, description="Зерно підприємства")
    owner_id: Optional[int] = Field(None, description="ID власника")
    owner_full_name: Optional[str] = Field(None, description="ПІБ власника")
    owner_phone: Optional[str] = Field(None, description="Телефон власника")
    
    is_internal_driver: bool = Field(True, description="Наш водій")
    driver_id: Optional[int] = Field(None, description="ID водія")
    external_driver_name: Optional[str] = Field(None, description="ПІБ стороннього водія")
    
    gross_weight_kg: float = Field(..., gt=0, description="Брутто, кг")
    tare_weight_kg: float = Field(..., gt=0, description="Тара, кг")
    
    impurity_percent: float = Field(0.0, ge=0, le=100, description="Відсоток втрат")
    pending_quality: bool = Field(False, description="Очікує % втрат")
    
    note: Optional[str] = Field(None, description="Примітка")


class GrainReserveRequest(BaseModel):
    """Схема бронювання зерна"""
    quantity_kg: float = Field(..., gt=0, description="Кількість, кг")


class GrainShipmentCreate(BaseModel):
    """Схема створення відправки зерна"""
    culture_id: int = Field(..., description="Культура")
    destination: str = Field(..., description="Куди відправляємо")
    quantity_kg: float = Field(..., gt=0, description="Кількість, кг")


class GrainShipmentUpdate(BaseModel):
    """Схема оновлення відправки зерна"""
    culture_id: Optional[int] = Field(None, description="Культура")
    destination: Optional[str] = Field(None, description="Куди відправляємо")
    quantity_kg: Optional[float] = Field(None, gt=0, description="Кількість, кг")


class GrainShipmentResponse(BaseModel):
    """Схема відповіді для відправки зерна"""
    id: int
    culture_id: int
    destination: str
    quantity_kg: float
    created_by_user_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class GrainIntakeResponse(BaseModel):
    """Схема відповіді для картки приходу"""
    id: int
    culture_id: int
    vehicle_type_id: int
    has_trailer: bool
    is_own_grain: bool
    owner_id: Optional[int]
    owner_full_name: Optional[str]
    owner_phone: Optional[str]
    is_internal_driver: bool
    driver_id: Optional[int]
    external_driver_name: Optional[str]
    gross_weight_kg: float
    tare_weight_kg: float
    net_weight_kg: float
    impurity_percent: float
    pending_quality: bool
    accepted_weight_kg: float
    note: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Схеми для закупівель (не зерно)

class PurchaseStockResponse(BaseModel):
    """Схема відповіді для складу закупівель"""
    id: int
    name: str
    category: PurchaseCategory
    quantity_kg: float
    reserved_kg: float
    sale_price_per_kg: float

    class Config:
        from_attributes = True


class PurchaseStockPriceUpdate(BaseModel):
    """Схема оновлення ціни продажу для складу закупівель"""
    sale_price_per_kg: float = Field(..., ge=0, description="Ціна продажу за кг")


class StockAdjustRequest(BaseModel):
    """Схема ручної зміни кількості на складі"""
    transaction_type: TransactionType = Field(..., description="Тип зміни")
    amount: float = Field(..., gt=0, description="Кількість, кг")


class StockAdjustmentResponse(BaseModel):
    """Схема відповіді для журналу ручних коригувань"""
    id: int
    stock_type: StockAdjustmentType
    culture_id: Optional[int]
    purchase_stock_id: Optional[int]
    category: Optional[PurchaseCategory]
    item_name: str
    transaction_type: TransactionType
    amount: float
    quantity_before: float
    quantity_after: float
    user_id: int
    user_full_name: str
    source: Optional[str]
    destination: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseCreate(BaseModel):
    """Схема створення закупівлі"""
    item_name: str = Field(..., description="Назва позиції")
    category: PurchaseCategory = Field(..., description="Категорія")
    price_per_kg: float = Field(..., gt=0, description="Ціна за кг")
    currency: Currency = Field(..., description="Валюта")
    quantity_kg: float = Field(..., gt=0, description="Кількість, кг")


class PurchaseResponse(BaseModel):
    """Схема відповіді для закупівлі"""
    id: int
    item_name: str
    category: PurchaseCategory
    price_per_kg: float
    currency: Currency
    quantity_kg: float
    total_amount: float
    created_at: datetime

    class Config:
        from_attributes = True


class GrainQualityUpdateRequest(BaseModel):
    """Схема оновлення якості"""
    impurity_percent: float = Field(..., ge=0, le=100, description="Відсоток втрат")


class GrainIntakeUpdateRequest(BaseModel):
    """Схема оновлення картки приходу"""
    culture_id: Optional[int] = None
    vehicle_type_id: Optional[int] = None
    has_trailer: Optional[bool] = None
    is_own_grain: Optional[bool] = None
    owner_id: Optional[int] = None
    owner_full_name: Optional[str] = None
    owner_phone: Optional[str] = None
    is_internal_driver: Optional[bool] = None
    driver_id: Optional[int] = None
    external_driver_name: Optional[str] = None
    gross_weight_kg: Optional[float] = Field(None, gt=0)
    tare_weight_kg: Optional[float] = Field(None, gt=0)
    impurity_percent: Optional[float] = Field(None, ge=0, le=100)
    pending_quality: Optional[bool] = None
    note: Optional[str] = None


class DriverStatResponse(BaseModel):
    """Схема відповіді для статистики водія"""
    driver_id: int
    driver_name: str
    vehicle_type_id: int
    vehicle_type_name: str
    culture_id: int
    culture_name: str
    has_trailer: bool
    trips: int
    total_net_weight_kg: float
    total_accepted_weight_kg: float


# Схемы для орендодавців

class LandlordCreate(BaseModel):
    """Схема створення орендодавця"""
    full_name: str = Field(..., description="ПІБ орендодавця")
    phone: Optional[str] = Field(default=None, description="Телефон")


class LandlordResponse(BaseModel):
    """Схема відповіді для орендодавця"""
    id: int
    full_name: str
    phone: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LandlordUpdate(BaseModel):
    """Схема оновлення орендодавця"""
    full_name: Optional[str] = Field(default=None, description="ПІБ орендодавця")
    phone: Optional[str] = Field(default=None, description="Телефон")


class LeaseContractItemCreate(BaseModel):
    """Схема створення позиції контракту"""
    culture_id: int = Field(..., description="Культура")
    quantity_kg: float = Field(..., gt=0, description="Кількість зерна за оренду, кг")
    price_per_kg_uah: float = Field(..., gt=0, description="Ціна зерна за кг в грн (для перерахунку)")


class LeaseContractItemResponse(BaseModel):
    """Схема відповіді для позиції контракту"""
    id: int
    contract_id: int
    culture_id: int
    culture_name: Optional[str] = None
    quantity_kg: float
    price_per_kg_uah: float

    class Config:
        from_attributes = True


class LeaseContractCreate(BaseModel):
    """Схема створення контракту оренди"""
    landlord_id: int = Field(..., description="ID орендодавця")
    field_name: str = Field(..., description="Назва поля")
    contract_items: list[LeaseContractItemCreate] = Field(..., min_length=1, description="Позиції контракту")
    contract_date: datetime = Field(..., description="Дата укладення контракту")
    is_active: bool = Field(True, description="Чи активний контракт")
    note: Optional[str] = Field(None, description="Примітка")


class LeaseContractResponse(BaseModel):
    """Схема відповіді для контракту оренди"""
    id: int
    landlord_id: int
    landlord_full_name: str
    field_name: str
    contract_items: list[LeaseContractItemResponse]
    contract_date: datetime
    is_active: bool
    note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LeaseContractUpdate(BaseModel):
    """Схема оновлення контракту оренди"""
    landlord_id: Optional[int] = Field(default=None, description="ID орендодавця")
    field_name: Optional[str] = Field(default=None, description="Назва поля")
    contract_items: Optional[list[LeaseContractItemCreate]] = Field(default=None, min_length=1)
    contract_date: Optional[datetime] = Field(default=None, description="Дата укладення контракту")
    is_active: Optional[bool] = Field(default=None, description="Активний контракт")
    note: Optional[str] = Field(default=None, description="Примітка")


class LeasePaymentGrainItemCreate(BaseModel):
    """Схема створення позиції виплати зерном"""
    culture_id: int = Field(..., description="Культура")
    quantity_kg: float = Field(..., gt=0, description="Кількість зерна, кг")


class LeasePaymentGrainItemResponse(BaseModel):
    """Схема відповіді для позиції виплати зерном"""
    id: int
    payment_id: int
    culture_id: int
    culture_name: Optional[str] = None
    quantity_kg: float

    class Config:
        from_attributes = True


class LeasePaymentCreate(BaseModel):
    """Схема створення виплати по контракту"""
    contract_id: int = Field(..., description="ID контракту")
    payment_type: str = Field(..., description="Тип виплати: 'grain' або 'cash'")
    # Для виплати зерном - массив позиций
    grain_items: Optional[list[LeasePaymentGrainItemCreate]] = Field(default=None, description="Позиції виплати зерном")
    # Для виплати грошима
    currency: Optional[str] = Field(default=None, description="Валюта (якщо виплата грошима)")
    amount: Optional[float] = Field(default=None, gt=0, description="Сума (якщо виплата грошима)")
    # Загальні поля
    payment_date: datetime = Field(..., description="Дата виплати")
    note: Optional[str] = Field(default=None, description="Примітка")


class LeasePaymentResponse(BaseModel):
    """Схема відповіді для виплати по контракту"""
    id: int
    contract_id: int
    contract_field_name: Optional[str] = None
    landlord_full_name: Optional[str] = None
    payment_type: str
    grain_items: Optional[list[LeasePaymentGrainItemResponse]] = None
    currency: Optional[str]
    amount: Optional[float]
    payment_date: datetime
    note: Optional[str]
    created_by_user_id: Optional[int]
    created_by_user_full_name: Optional[str] = None
    created_at: datetime
    is_cancelled: bool = False

    class Config:
        from_attributes = True

