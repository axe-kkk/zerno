from sqlmodel import SQLModel, create_engine, Session, select, text
from backend.config import settings
from backend.models import (
    User,
    UserRole,
    CashRegister,
    GrainCulture,
    VehicleType,
    GrainStock
)

# Создание движка базы данных
engine = create_engine(
    settings.database_url,
    echo=settings.debug,  # Показывать SQL запросы в debug режиме
    pool_pre_ping=True,  # Проверка соединения перед использованием
)


def get_session():
    """Получение сессии базы данных"""
    with Session(engine) as session:
        yield session


def init_db():
    """Инициализация базы данных (создание таблиц, супер админа и кассы)"""
    SQLModel.metadata.create_all(engine)

    # Міграція: додаємо is_cancelled до lease_payments якщо колонки ще немає
    with engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE lease_payments ADD COLUMN is_cancelled BOOLEAN DEFAULT FALSE"
            ))
            conn.commit()
            print("✅ Додано колонку is_cancelled до lease_payments")
        except Exception:
            conn.rollback()  # Колонка вже існує

        try:
            conn.execute(text(
                "ALTER TABLE grain_stock ADD COLUMN reserved_kg DOUBLE PRECISION DEFAULT 0"
            ))
            conn.commit()
            print("✅ Додано колонку reserved_kg до grain_stock")
        except Exception:
            conn.rollback()

        try:
            conn.execute(text(
                "ALTER TABLE farmer_contract_items ADD COLUMN direction VARCHAR(32) DEFAULT 'from_company'"
            ))
            conn.commit()
            print("✅ Додано колонку direction до farmer_contract_items")
        except Exception:
            conn.rollback()

        try:
            conn.execute(text(
                "ALTER TABLE farmer_contract_items ADD COLUMN delivered_kg DOUBLE PRECISION DEFAULT 0"
            ))
            conn.commit()
            print("✅ Додано колонку delivered_kg до farmer_contract_items")
        except Exception:
            conn.rollback()

        try:
            conn.execute(text(
                "ALTER TABLE farmer_contract_payments ADD COLUMN contract_item_id INTEGER"
            ))
            conn.commit()
            print("✅ Додано колонку contract_item_id до farmer_contract_payments")
        except Exception:
            conn.rollback()

        try:
            conn.execute(text(
                "ALTER TABLE farmer_contract_payments ADD COLUMN item_name VARCHAR(255)"
            ))
            conn.commit()
            print("✅ Додано колонку item_name до farmer_contract_payments")
        except Exception:
            conn.rollback()

        # Міграція: конвертуємо enum-колонки в VARCHAR(32) для уникнення проблем з PostgreSQL enum
        for tbl, col in [
            ("farmer_contracts", "contract_type"),
            ("farmer_contracts", "status"),
            ("farmer_contract_items", "item_type"),
            ("farmer_contract_payments", "payment_type"),
        ]:
            try:
                conn.execute(text(
                    f"ALTER TABLE {tbl} ALTER COLUMN {col} TYPE VARCHAR(32) USING {col}::text"
                ))
                conn.commit()
                print(f"✅ Конвертовано {tbl}.{col} в VARCHAR(32)")
            except Exception:
                conn.rollback()

        # Нормалізуємо значення enum-колонок до нижнього регістру
        try:
            conn.execute(text("UPDATE farmer_contracts SET contract_type = LOWER(contract_type), status = LOWER(status)"))
            conn.execute(text("UPDATE farmer_contract_items SET item_type = LOWER(item_type), direction = LOWER(direction)"))
            conn.execute(text("UPDATE farmer_contract_payments SET payment_type = LOWER(payment_type)"))
            conn.commit()
        except Exception:
            conn.rollback()

        # Міграції для нових полів farmer_contracts (4 типи контрактів)
        try:
            conn.execute(text(
                "ALTER TABLE farmer_contracts ADD COLUMN currency VARCHAR(8)"
            ))
            conn.commit()
            print("✅ Додано колонку currency до farmer_contracts")
        except Exception:
            conn.rollback()

        try:
            conn.execute(text(
                "ALTER TABLE farmer_contracts ADD COLUMN exchange_rate DOUBLE PRECISION"
            ))
            conn.commit()
            print("✅ Додано колонку exchange_rate до farmer_contracts")
        except Exception:
            conn.rollback()

        try:
            conn.execute(text(
                "ALTER TABLE farmer_contracts ADD COLUMN was_reserve BOOLEAN DEFAULT FALSE"
            ))
            conn.commit()
            print("✅ Додано колонку was_reserve до farmer_contracts")
        except Exception:
            conn.rollback()
    
    with Session(engine) as session:
        # Создание супер админа, если его еще нет
        admin = session.exec(
            select(User).where(User.username == settings.admin_username)
        ).first()
        
        if not admin:
            # Импортируем локально, чтобы избежать циклического импорта
            from backend.auth import get_password_hash
            
            admin = User(
                username=settings.admin_username,
                password_hash=get_password_hash(settings.admin_password),
                password_plain=settings.admin_password,  # Сохраняем пароль в открытом виде
                full_name=settings.admin_full_name,
                role=UserRole.SUPER_ADMIN,
                is_active=True
            )
            session.add(admin)
            session.commit()
            print(f"✅ Супер админ создан: {settings.admin_username}")
        
        # Создание кассы, если ее еще нет
        cash_register = session.exec(select(CashRegister)).first()
        
        if not cash_register:
            cash_register = CashRegister(
                uah_balance=0.0,
                usd_balance=0.0,
                eur_balance=0.0
            )
            session.add(cash_register)
            session.commit()
            print("✅ Касса инициализирована с нулевыми балансами")

        # Инициализация культур зерна
        default_cultures = [
            "Ячмінь",
            "Пшениця",
            "Горох",
            "Ріпак",
            "Соняшник",
            "Кукурудза",
            "Льон"
        ]
        for culture_name in default_cultures:
            exists = session.exec(
                select(GrainCulture).where(GrainCulture.name == culture_name)
            ).first()
            if not exists:
                session.add(GrainCulture(name=culture_name, price_per_kg=1.0))
        session.commit()

        # Мінімальна ціна 1 для всіх позицій на складі
        from backend.models import PurchaseStock
        zero_cultures = session.exec(
            select(GrainCulture).where(GrainCulture.price_per_kg < 1.0)
        ).all()
        for c in zero_cultures:
            c.price_per_kg = 1.0
            session.add(c)

        zero_stocks = session.exec(
            select(PurchaseStock).where(PurchaseStock.sale_price_per_kg < 1.0)
        ).all()
        for s in zero_stocks:
            s.sale_price_per_kg = 1.0
            session.add(s)
        if zero_cultures or zero_stocks:
            session.commit()
            print(f"✅ Оновлено ціни: {len(zero_cultures)} культур, {len(zero_stocks)} товарів (мін. 1 грн/кг)")

        # Инициализация типов транспорта
        default_vehicle_types = [
            "КамАЗ",
            "ГАЗ",
            "ЗИЛ",
            "Фура",
            "Трактор",
            "КрАЗ",
            "Легковой автомобіль"
        ]
        for vehicle_name in default_vehicle_types:
            exists = session.exec(
                select(VehicleType).where(VehicleType.name == vehicle_name)
            ).first()
            if not exists:
                session.add(VehicleType(name=vehicle_name))
        session.commit()

        # Инициализация склада для каждой культуры
        cultures = session.exec(select(GrainCulture)).all()
        for culture in cultures:
            stock = session.exec(
                select(GrainStock).where(GrainStock.culture_id == culture.id)
            ).first()
            if not stock:
                session.add(GrainStock(culture_id=culture.id, quantity_kg=0.0))
        session.commit()

