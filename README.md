# Car Flip Manager

React-приложение на русском языке для учета автомобилей в перепродаже: VIN, покупка, доставка, ремонт, запчасти, дополнительные расходы, продажа, статусы, фото и прибыль.

Данные автомобилей теперь хранятся в Supabase. В приложении есть регистрация и вход по email/password, а доступ к автомобилям ограничен владельцем записи через Row Level Security.

## Запуск локально

```bash
npm run dev
```

Откройте `http://localhost:5173`.

## Сборка

```bash
npm run build
npm run preview
```

Проект не требует установки npm-зависимостей: React, Supabase JS и XLSX загружаются как ES-модули из CDN, а локальный сервер и сборка используют встроенные возможности Node.js.

## Подключение Supabase

Проект уже указывает на Supabase URL `https://juhesiosvievacpiijjz.supabase.co`; для запуска нужно добавить publishable key и выполнить SQL-схему.

### 1. Какой SQL выполнить в SQL Editor

1. В Supabase Dashboard откройте **SQL Editor → New query**.
2. Скопируйте весь SQL из файла `supabase-schema.sql`.
3. Нажмите **Run**. Скрипт создаст таблицы `cars`, `expenses`, `notes`, `sales`, индексы, триггеры `updated_at` и RLS-политики для данных текущего пользователя.

### 2. Где вставить publishable key

1. В Supabase Dashboard откройте **Project Settings → API → Project API keys**.
2. Скопируйте **Publishable key**.
3. Вставьте его в `src/supabase-config.js`:

```js
export const SUPABASE_URL = 'https://juhesiosvievacpiijjz.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'your-publishable-key';
```

`SUPABASE_ANON_KEY` оставлен как совместимый алиас и автоматически получает то же значение.

### 3. Как проверить подключение

1. В разделе **Authentication → Sign In / Providers → Email** убедитесь, что email/password вход включен.
2. Если включено подтверждение email, добавьте адрес локальной разработки в **Authentication → URL Configuration → Site URL**:

```text
http://localhost:5173
```

3. Запустите приложение командой `npm run dev` и откройте `http://localhost:5173`.
4. Зарегистрируйтесь или войдите по email/password.
5. Создайте тестовый автомобиль и проверьте, что строка появилась в **Table Editor → cars**.
6. Если в браузере уже были данные старой версии в `localStorage` под ключом `car-flip-manager-cars`, после первого входа приложение автоматически перенесет их в таблицу `cars` и покажет сообщение о количестве перенесенных авто.
7. Для публикации на GitHub Pages также добавьте production-адрес Pages в Supabase Auth URL Configuration, чтобы подтверждение email и редиректы работали корректно.

## Структура таблиц Supabase

SQL-схема находится в `supabase-schema.sql` и создает четыре таблицы:

- `public.cars` — основной список автомобилей и поля, которые нужны текущему интерфейсу: VIN, марка, модель, статус, фото, покупка, вложения, продажа и заметка;
- `public.expenses` — нормализованные расходы по автомобилю (`purchase`, `delivery`, `repair`, `parts`, `other`) для будущего расширения детализации вложений;
- `public.notes` — отдельные заметки по автомобилю для будущей истории комментариев;
- `public.sales` — отдельная запись продажи по автомобилю для будущего расширения блока продаж;
- во всех таблицах есть `user_id`, `created_at`, `updated_at`; RLS-политики `select`, `insert`, `update`, `delete` разрешают пользователю работать только со своими строками.

## Экспорт и резервное копирование

- **Экспорт в Excel** выгружает автомобили текущего пользователя в `car-flip-manager.xlsx`.
- **Импорт из Excel** заменяет список автомобилей текущего пользователя в Supabase на данные из выбранного файла.
- **Резервная копия JSON** скачивает автомобили текущего пользователя в `car-flip-manager-backup.json`.

## Публикация через GitHub Pages

Проект подготовлен для GitHub Pages:

- сборка создает статические файлы в `dist/`;
- пути к локальным модулям относительные, поэтому приложение работает в подпапке репозитория GitHub Pages;
- workflow `.github/workflows/deploy-pages.yml` автоматически публикует `dist/` при push в ветку `main` или ручном запуске из GitHub Actions;
- файл `dist/.nojekyll` отключает обработку Jekyll на GitHub Pages.

### Как опубликовать

1. Загрузите репозиторий на GitHub и убедитесь, что основная ветка называется `main`.
2. Откройте репозиторий на GitHub: **Settings → Pages**.
3. В разделе **Build and deployment** выберите **Source: GitHub Actions**.
4. Выполните push в `main` или запустите workflow **Deploy to GitHub Pages** вручную во вкладке **Actions**.
5. После успешного выполнения workflow приложение будет доступно по адресу:

```text
https://<ваш-github-логин>.github.io/car-flip-manager/
```

Если репозиторий опубликован под другим именем, замените `car-flip-manager` в ссылке на имя репозитория.
