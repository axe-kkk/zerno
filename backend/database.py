from sqlmodel import SQLModel, create_engine, Session, select, text
from backend.config import settings
from backend.models import (
    User,
    UserRole,
    CashRegister,
    GrainCulture,
    VehicleType,
    GrainStock,
    AgriField
)

# Создание движка базы данных (echo=False — щоб не спамити логи SQL-запитами)
engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)


def get_session():
    """Получение сессии базы данных"""
    with Session(engine) as session:
        yield session


def init_db():
    """Инициализация базы данных (создание таблиц, супер админа и кассы)"""
    SQLModel.metadata.create_all(engine)

    # Міграції колонок: IF NOT EXISTS — без ERROR у логах Postgres при повторному init_db
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE lease_payments ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()

        conn.execute(text(
            "ALTER TABLE lease_payment_grain_items ADD COLUMN IF NOT EXISTS from_own_kg DOUBLE PRECISION DEFAULT 0"
        ))
        conn.execute(text(
            "ALTER TABLE lease_payment_grain_items ADD COLUMN IF NOT EXISTS from_farmer_kg DOUBLE PRECISION DEFAULT 0"
        ))
        conn.commit()

        conn.execute(text(
            "ALTER TABLE grain_stock ADD COLUMN IF NOT EXISTS reserved_kg DOUBLE PRECISION DEFAULT 0"
        ))
        conn.commit()

        conn.execute(text(
            "ALTER TABLE farmer_contract_items ADD COLUMN IF NOT EXISTS direction VARCHAR(32) DEFAULT 'from_company'"
        ))
        conn.execute(text(
            "ALTER TABLE farmer_contract_items ADD COLUMN IF NOT EXISTS delivered_kg DOUBLE PRECISION DEFAULT 0"
        ))
        conn.commit()

        conn.execute(text(
            "ALTER TABLE farmer_contract_payments ADD COLUMN IF NOT EXISTS contract_item_id INTEGER"
        ))
        conn.execute(text(
            "ALTER TABLE farmer_contract_payments ADD COLUMN IF NOT EXISTS item_name VARCHAR(255)"
        ))
        conn.commit()

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
        conn.execute(text(
            "ALTER TABLE farmer_contracts ADD COLUMN IF NOT EXISTS currency VARCHAR(8)"
        ))
        conn.execute(text(
            "ALTER TABLE farmer_contracts ADD COLUMN IF NOT EXISTS exchange_rate DOUBLE PRECISION"
        ))
        conn.execute(text(
            "ALTER TABLE farmer_contracts ADD COLUMN IF NOT EXISTS was_reserve BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()

        for col_def in [
            ("payment_format", "VARCHAR(32) DEFAULT 'none'"),
            ("driver_id", "INTEGER"),
            ("vehicle_type_id", "INTEGER"),
        ]:
            conn.execute(text(
                f"ALTER TABLE grain_shipments ADD COLUMN IF NOT EXISTS {col_def[0]} {col_def[1]}"
            ))
        conn.commit()

        conn.execute(text(
            "ALTER TABLE purchase_records ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()

        conn.execute(text(
            "ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS end_date TIMESTAMP"
        ))
        conn.execute(text(
            "ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS parent_contract_id INTEGER REFERENCES lease_contracts(id)"
        ))
        conn.commit()

        # Заповнення end_date для існуючих контрактів (contract_date + 1 рік)
        try:
            conn.execute(text(
                "UPDATE lease_contracts SET end_date = contract_date + INTERVAL '1 year' WHERE end_date IS NULL"
            ))
            conn.commit()
            print("✅ Заповнено end_date для існуючих контрактів")
        except Exception:
            conn.rollback()

        conn.execute(text(
            "ALTER TABLE grain_intakes ADD COLUMN IF NOT EXISTS is_own_combine BOOLEAN DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE grain_intakes ADD COLUMN IF NOT EXISTS field_id INTEGER REFERENCES agri_fields(id)"
        ))
        conn.execute(text(
            "ALTER TABLE grain_intakes ADD COLUMN IF NOT EXISTS is_farmer_transfer BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()

        try:
            conn.execute(text(
                "UPDATE grain_intakes SET is_farmer_transfer = TRUE "
                "WHERE note IS NOT NULL AND note ILIKE 'Трансфер від%'"
            ))
            conn.commit()
            print("✅ Позначено існуючі трансфери між фермерами в grain_intakes")
        except Exception:
            conn.rollback()

        conn.execute(text(
            "ALTER TABLE grain_intakes ADD COLUMN IF NOT EXISTS pending_tare BOOLEAN DEFAULT FALSE"
        ))
        conn.commit()

        conn.execute(text(
            "ALTER TABLE farmer_contract_items ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT 'UAH'"
        ))
        conn.commit()

        # Міграція: users.role — конвертуємо нативний enum у VARCHAR(32),
        # щоб додати нову роль "manager" без перетворення типу.
        try:
            conn.execute(text(
                "ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(32) USING role::text"
            ))
            conn.commit()
            print("✅ Конвертовано users.role в VARCHAR(32)")
        except Exception:
            conn.rollback()

        # SQLAlchemy старі версії зберігали enum NAME (SUPER_ADMIN) замість value (super_admin).
        # Нормалізуємо до нижнього регістру, бо Pydantic очікує саме значення enum.
        try:
            conn.execute(text("UPDATE users SET role = LOWER(role) WHERE role <> LOWER(role)"))
            conn.commit()
        except Exception:
            conn.rollback()

        # Міграція: «Люди» — окрема сутність, що може купувати у нас і приймати трансфери зерна.
        conn.execute(text(
            "ALTER TABLE farmer_contracts ADD COLUMN IF NOT EXISTS person_id INTEGER REFERENCES people(id)"
        ))
        # owner_id був NOT NULL — тепер контракт може бути або з фермером, або з людиною.
        try:
            conn.execute(text(
                "ALTER TABLE farmer_contracts ALTER COLUMN owner_id DROP NOT NULL"
            ))
        except Exception:
            conn.rollback()
        conn.execute(text(
            "ALTER TABLE farmer_grain_movements ADD COLUMN IF NOT EXISTS to_person_id INTEGER REFERENCES people(id)"
        ))
        conn.commit()

        # Баланс зерна у людей (новий бакет в grain_stock). Бекап з історичних
        # переказів to_person_id: повертаємо зерно на склад і кладемо у новий бакет.
        # Стара логіка фізично зменшувала quantity_kg при переказі до людини; тепер
        # переказ — це внутрішня переуступка з farmer_quantity_kg в person_quantity_kg.
        conn.execute(text(
            "ALTER TABLE grain_stock ADD COLUMN IF NOT EXISTS person_quantity_kg DOUBLE PRECISION DEFAULT 0"
        ))
        conn.commit()

        try:
            already_migrated = conn.execute(text(
                "SELECT COALESCE(SUM(person_quantity_kg), 0) FROM grain_stock"
            )).scalar() or 0
            # Запускаємо бекап лише один раз — якщо ще нікому з людей баланс не нараховувався.
            if float(already_migrated) <= 0:
                conn.execute(text(
                    """
                    WITH person_transfers AS (
                        SELECT culture_id, COALESCE(SUM(quantity_kg), 0) AS total_kg
                        FROM farmer_grain_movements
                        WHERE to_person_id IS NOT NULL
                          AND movement_type = 'transfer'
                        GROUP BY culture_id
                    )
                    UPDATE grain_stock gs
                    SET person_quantity_kg = pt.total_kg,
                        quantity_kg = gs.quantity_kg + pt.total_kg
                    FROM person_transfers pt
                    WHERE gs.culture_id = pt.culture_id
                      AND pt.total_kg > 0
                    """
                ))
                conn.commit()
                print("✅ Бекап: зерно з історичних переказів to_person повернуто на склад у person_quantity_kg")
        except Exception as exc:
            print(f"⚠️  Бекап person_quantity_kg пропущено: {exc}")
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

