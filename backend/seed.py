"""Сід тестових даних: ~700 записів, розкиданих за 12 місяців.

Запуск:
    docker compose exec backend python -m backend.seed

Безпечно: працює тільки на порожній БД (перевіряє наявність фермерів/людей).
Якщо вже є дані — нічого не робить.
"""
from datetime import datetime, timedelta
from random import Random
from sqlmodel import Session, select

from backend.database import engine
from backend.models import (
    User, UserRole,
    GrainCulture, VehicleType, Driver, GrainOwner, Person,
    GrainStock, GrainIntake, GrainShipment, FarmerGrainMovement, FarmerGrainDeduction,
    StockAdjustmentLog, StockAdjustmentType, TransactionType,
    PurchaseStock, PurchaseRecord, PurchaseCategory,
    Currency, CashRegister, Transaction,
    AgriField, Landlord, LeaseParcel, LeasePeriod, LeasePeriodGrainItem, LeasePayment, LeasePaymentGrainItem,
    FarmerContract, FarmerContractItem, FarmerContractPayment,
    FarmerContractType, FarmerContractStatus, FarmerContractItemType, FarmerContractItemDirection,
    FarmerContractPaymentType,
)
from backend.auth import get_password_hash

R = Random(42)  # фіксований seed → відтворюваність

NOW = datetime.utcnow()
START_DATE = NOW - timedelta(days=365)


def rand_dt() -> datetime:
    """Випадкова дата у межах останніх 12 місяців."""
    delta = (NOW - START_DATE).total_seconds()
    return START_DATE + timedelta(seconds=R.uniform(0, delta))


FIRST_NAMES_M = ['Іван','Петро','Микола','Андрій','Олег','Сергій','Володимир','Юрій','Богдан','Василь','Михайло','Артем','Дмитро','Євген','Григорій']
FIRST_NAMES_F = ['Олена','Марія','Ірина','Тетяна','Наталія','Світлана','Галина','Людмила','Катерина','Валентина','Юлія','Оксана','Лариса','Віра','Анна']
LAST_NAMES = ['Шевченко','Коваленко','Бондаренко','Ткаченко','Ковальчук','Кравченко','Олійник','Мельник','Іщенко','Лисенко','Гончар','Карпенко','Шульга','Стеценко','Поліщук','Романюк','Москаленко','Юрченко']
PATRONYMICS_M = ['Іванович','Петрович','Миколайович','Андрійович','Сергійович','Богданович','Васильович','Михайлович']
PATRONYMICS_F = ['Іванівна','Петрівна','Миколаївна','Андріївна','Сергіївна','Богданівна','Василівна','Михайлівна']

VILLAGES = ['Дніпровка','Лиман','Степове','Зорянка','Журавлине','Радісне','Новопіль','Берегове','Високе','Затока','Зелений Гай','Степи','Південне','Берег']

def gen_name(female: bool = False) -> str:
    if female:
        return f'{R.choice(LAST_NAMES)} {R.choice(FIRST_NAMES_F)} {R.choice(PATRONYMICS_F)}'
    return f'{R.choice(LAST_NAMES)} {R.choice(FIRST_NAMES_M)} {R.choice(PATRONYMICS_M)}'


def gen_phone() -> str:
    code = R.choice(['050','063','067','068','073','093','095','097','098'])
    return f'+380{code}{R.randint(1000000, 9999999)}'


def seed():
    with Session(engine) as session:
        # Захист: не запускати на непорожній БД
        existing_owners = session.exec(select(GrainOwner)).first()
        if existing_owners:
            print('⚠️  БД не порожня — сід пропущено')
            return

        print('🌱 Сід тестових даних...')

        # Адмін повинен бути створений init_db. Для seed-операцій привʼяжемось до нього.
        admin = session.exec(select(User).where(User.role == UserRole.SUPER_ADMIN.value)).first()
        admin_id = admin.id if admin else None

        # Культури / транспорт / склад — створені init_db. Підтягуємо їх.
        cultures = session.exec(select(GrainCulture)).all()
        vehicle_types = session.exec(select(VehicleType)).all()
        if not cultures or not vehicle_types:
            print('❌ Немає культур/транспорту, init_db не відпрацював')
            return

        # ── Водії ────────────────────────────────────────────────
        drivers = []
        for _ in range(8):
            d = Driver(full_name=gen_name(), phone=gen_phone(), created_at=rand_dt())
            session.add(d)
            drivers.append(d)
        session.flush()
        print(f'  ✓ {len(drivers)} водіїв')

        # ── Фермери ─────────────────────────────────────────────
        owners = []
        for _ in range(30):
            o = GrainOwner(full_name=gen_name(), phone=gen_phone(), created_at=rand_dt())
            session.add(o)
            owners.append(o)
        session.flush()
        print(f'  ✓ {len(owners)} фермерів')

        # ── Люди (не-фермери) ───────────────────────────────────
        people = []
        for _ in range(20):
            p = Person(full_name=gen_name(R.random() < 0.4), phone=gen_phone() if R.random() < 0.7 else None, created_at=rand_dt())
            session.add(p)
            people.append(p)
        session.flush()
        print(f'  ✓ {len(people)} людей')

        # ── Орендодавці ────────────────────────────────────────
        landlords = []
        for _ in range(15):
            l = Landlord(full_name=gen_name(R.random() < 0.3), phone=gen_phone(), created_at=rand_dt())
            session.add(l)
            landlords.append(l)
        session.flush()
        print(f'  ✓ {len(landlords)} орендодавців')

        # ── Поля ───────────────────────────────────────────────
        fields = []
        for _ in range(25):
            name = f'{R.choice(VILLAGES)} {R.choice(["північ","південь","схід","захід","центр","гай","балка"])}'
            f = AgriField(name=name, owner_name='Підприємство', created_at=rand_dt())
            session.add(f)
            fields.append(f)
        session.flush()
        print(f'  ✓ {len(fields)} полів')

        # ── Склад зерна (init_db створив) ──────────────────────
        stocks = {s.culture_id: s for s in session.exec(select(GrainStock)).all()}

        # ── Прийоми зерна (~250) — головна історична таблиця ───
        intakes_count = 250
        for _ in range(intakes_count):
            culture = R.choice(cultures)
            is_own = R.random() < 0.25  # 25% — наше зерно (з поля)
            gross = R.uniform(8000, 25000)
            tare = R.uniform(3000, 6000)
            net = gross - tare
            impurity = R.uniform(0, 5)
            pending_q = R.random() < 0.05
            pending_t = R.random() < 0.03
            accepted = 0 if (pending_q or pending_t) else net * (1 - impurity / 100)
            driver = R.choice(drivers) if R.random() < 0.7 else None
            owner = None if is_own else R.choice(owners)
            field = R.choice(fields) if is_own else None

            intake = GrainIntake(
                culture_id=culture.id,
                vehicle_type_id=R.choice(vehicle_types).id,
                is_own_grain=is_own,
                field_id=field.id if field else None,
                owner_id=owner.id if owner else None,
                owner_full_name=owner.full_name if owner else None,
                owner_phone=owner.phone if owner else None,
                is_internal_driver=bool(driver),
                driver_id=driver.id if driver else None,
                external_driver_name=None if driver else f'Сторонній {R.randint(1, 99)}',
                has_trailer=R.random() < 0.3,
                is_own_combine=R.random() < 0.2,
                gross_weight_kg=round(gross, 2),
                tare_weight_kg=0 if pending_t else round(tare, 2),
                net_weight_kg=0 if pending_t else round(net, 2),
                impurity_percent=round(impurity, 2),
                pending_quality=pending_q,
                pending_tare=pending_t,
                accepted_weight_kg=round(accepted, 2),
                created_by_user_id=admin_id,
                created_at=rand_dt(),
            )
            session.add(intake)

            # Оновлюємо склад тільки для підтверджених
            if not (pending_q or pending_t):
                s = stocks[culture.id]
                s.quantity_kg += accepted
                if is_own:
                    s.own_quantity_kg += accepted
                else:
                    s.farmer_quantity_kg += accepted
        for s in stocks.values():
            session.add(s)
        print(f'  ✓ {intakes_count} прийомів зерна')

        # ── Відправки (~70) ────────────────────────────────────
        for _ in range(70):
            culture = R.choice(cultures)
            qty = R.uniform(5000, 30000)
            session.add(GrainShipment(
                culture_id=culture.id,
                destination=f'{R.choice(["Хлібозавод", "Елеватор", "ТОВ", "ПП", "СГТОВ"])} «{R.choice(VILLAGES)}»',
                quantity_kg=round(qty, 2),
                payment_format=R.choice(['none', 'cash', 'cashless']),
                driver_id=R.choice(drivers).id if R.random() < 0.7 else None,
                vehicle_type_id=R.choice(vehicle_types).id,
                created_by_user_id=admin_id,
                created_at=rand_dt(),
            ))
        print('  ✓ 70 відправок')

        # ── Покупки (~50) ──────────────────────────────────────
        purchase_items = [
            ('Аміачна селітра', PurchaseCategory.FERTILIZER, 'аміачна селітра'),
            ('Карбамід', PurchaseCategory.FERTILIZER, 'карбамід'),
            ('Нітроамофоска', PurchaseCategory.FERTILIZER, 'нітроамофоска'),
            ('Калій хлористий', PurchaseCategory.FERTILIZER, 'калій хлористий'),
            ('Насіння пшениці', PurchaseCategory.SEED, 'насіння пшениці'),
            ('Насіння соняшнику', PurchaseCategory.SEED, 'насіння соняшнику'),
            ('Насіння кукурудзи', PurchaseCategory.SEED, 'насіння кукурудзи'),
            ('Насіння ріпаку', PurchaseCategory.SEED, 'насіння ріпаку'),
        ]
        # Спочатку додаємо склад
        pstocks = {}
        for name, cat, norm in purchase_items:
            ps = PurchaseStock(name=name, normalized_name=norm, category=cat, quantity_kg=0, sale_price_per_kg=R.uniform(15, 80))
            session.add(ps)
            pstocks[name] = ps
        session.flush()

        for _ in range(50):
            name, cat, norm = R.choice(purchase_items)
            qty = R.uniform(200, 3000)
            price = R.uniform(15, 80)
            is_free = R.random() < 0.1
            ps = pstocks[name]
            ps.quantity_kg += qty
            session.add(PurchaseRecord(
                stock_id=ps.id,
                item_name=name,
                normalized_name=norm,
                category=cat,
                price_per_kg=round(price, 2) if not is_free else 0,
                currency=Currency.UAH,
                quantity_kg=round(qty, 2),
                total_amount=0 if is_free else round(qty * price, 2),
                is_free=is_free,
                created_by_user_id=admin_id,
                created_at=rand_dt(),
            ))
        print('  ✓ 50 покупок')

        # ── Каса + транзакції (~60) ────────────────────────────
        cash = session.exec(select(CashRegister)).first()
        if not cash:
            cash = CashRegister(uah_balance=0, usd_balance=0, eur_balance=0)
            session.add(cash)
            session.flush()
        # Накачаємо початковий баланс
        cash.uah_balance = 500000
        cash.usd_balance = 5000
        cash.eur_balance = 3000

        descs = ['Зарплата', 'Виплата фермеру', 'Закупка дизпалива', 'Виплата орендодавцю', 'Поповнення', 'Готівка з банку', 'Витрати']
        for _ in range(60):
            cur = R.choice([Currency.UAH, Currency.UAH, Currency.UAH, Currency.USD, Currency.EUR])
            tx_type = R.choice([TransactionType.ADD, TransactionType.SUBTRACT])
            amt = R.uniform(500, 50000) if cur == Currency.UAH else R.uniform(50, 1000)
            sign = 1 if tx_type == TransactionType.ADD else -1
            if cur == Currency.UAH:
                cash.uah_balance += sign * amt
            elif cur == Currency.USD:
                cash.usd_balance += sign * amt
            else:
                cash.eur_balance += sign * amt
            session.add(Transaction(
                currency=cur,
                amount=round(amt, 2),
                transaction_type=tx_type,
                user_id=admin_id,
                description=R.choice(descs),
                uah_balance_after=round(cash.uah_balance, 2),
                usd_balance_after=round(cash.usd_balance, 2),
                eur_balance_after=round(cash.eur_balance, 2),
                created_at=rand_dt(),
            ))
        session.add(cash)
        print('  ✓ 60 касових операцій')

        # ── Контракти фермерів (~25) ───────────────────────────
        contracts_created = 0
        for _ in range(25):
            owner = R.choice(owners)
            ctype = R.choice(['debt', 'payment', 'reserve'])
            total = R.uniform(5000, 80000)
            status = 'closed' if ctype == 'payment' else ('pending' if ctype == 'reserve' else 'open')
            balance = 0 if status == 'closed' else total * R.uniform(0.3, 1.0)
            c = FarmerContract(
                owner_id=owner.id,
                contract_type=ctype,
                status=status,
                total_value_uah=round(total, 2),
                balance_uah=round(balance, 2),
                currency='UAH',
                note=R.choice(['', 'Контракт A', 'Зимовий', 'Літній цикл', '']),
                created_by_user_id=admin_id,
                created_at=rand_dt(),
            )
            session.add(c)
            contracts_created += 1
        session.flush()
        print(f'  ✓ {contracts_created} контрактів фермерів')

        # ── Орендні ділянки з річними періодами (~10) ──────────
        lease_count = 10
        for _ in range(lease_count):
            ll = R.choice(landlords)
            start = START_DATE + timedelta(days=R.randint(0, 200))
            terms = R.choice(['grain', 'cash', 'grain_cash'])
            parcel = LeaseParcel(
                landlord_id=ll.id,
                landlord_full_name=ll.full_name,
                area_ha=round(R.uniform(1, 25), 2),
                label=R.choice([None, R.choice(VILLAGES)]),
                payment_terms=terms,
                start_date=start,
                is_active=True,
                created_at=start,
            )
            session.add(parcel)
            session.flush()
            # 1-2 річних періоди
            for yi in range(R.randint(1, 2)):
                year = start.year + yi
                p_start = start.replace(year=year)
                period = LeasePeriod(
                    parcel_id=parcel.id,
                    year=year,
                    period_start=p_start,
                    period_end=p_start + timedelta(days=365),
                    cash_amount=(round(R.uniform(3000, 15000), 2) if terms in ('cash', 'grain_cash') else 0.0),
                    cash_currency='UAH',
                )
                session.add(period)
                session.flush()
                if terms in ('grain', 'grain_cash'):
                    for _ in range(R.randint(1, 3)):
                        culture = R.choice(cultures)
                        session.add(LeasePeriodGrainItem(
                            period_id=period.id,
                            culture_id=culture.id,
                            quantity_kg=round(R.uniform(500, 5000), 2),
                            price_per_kg_uah=round(R.uniform(8, 18), 2),
                        ))
        print(f'  ✓ {lease_count} орендних ділянок')

        session.commit()
        print('\n🎉 Сід завершено\n')


if __name__ == '__main__':
    seed()
