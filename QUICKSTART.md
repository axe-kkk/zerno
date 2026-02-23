# 🚀 Швидкий старт

## Запуск через Docker Compose (найпростіший спосіб)

### Крок 1: Переконайтеся, що Docker встановлено

Перевірте встановлення:
```bash
docker --version
docker-compose --version
```

Якщо не встановлено - завантажте з [docker.com](https://www.docker.com/get-started)

### Крок 2: Запустіть проект

Відкрийте термінал в папці проекту та виконайте:

```bash
docker-compose up -d
```

Це запустить:
- ✅ PostgreSQL базу даних
- ✅ Backend API (FastAPI)
- ✅ Frontend (Nginx)

### Крок 3: Відкрийте браузер

Перейдіть за адресою: **http://localhost**

### Крок 4: Ввійдіть в систему

- **Ім'я користувача:** `admin`
- **Пароль:** `admin123`

---

## Корисні команди

### Переглянути логи
```bash
docker-compose logs -f
```

### Зупинити проект
```bash
docker-compose down
```

### Зупинити та видалити всі дані
```bash
docker-compose down -v
```

### Перезапустити проект
```bash
docker-compose restart
```

### Перебудувати образи
```bash
docker-compose up -d --build
```

---

## Доступ до сервісів

- **Frontend:** http://localhost
- **Backend API:** http://localhost/api
- **API Документація:** http://localhost/api/docs
- **PostgreSQL:** localhost:5432

---

## Налаштування

Всі налаштування знаходяться в `docker-compose.yml`. Можете змінити:
- Пароль адміна
- Пароль бази даних
- Порти
- Інші параметри

Після змін виконайте:
```bash
docker-compose down
docker-compose up -d
```

---

## Вирішення проблем

### Порт вже зайнятий
Якщо порт 80 або 5432 зайнятий, змініть порти в `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # замість 80:80
```

### Помилка підключення до бази даних
Зачекайте 10-15 секунд після запуску - база даних потребує часу на ініціалізацію.

### Перебудувати все з нуля
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

Готово! 🎉













