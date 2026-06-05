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

1. Создайте проект в [Supabase](https://supabase.com/).
2. В Supabase Dashboard откройте **Project Settings → Data API**.
3. Скопируйте **Project URL** и публичный **anon/public key**.
4. Откройте файл `src/supabase-config.js` и заполните значения:

```js
export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-or-publishable-key';
```

5. В Supabase Dashboard откройте **SQL Editor → New query**.
6. Скопируйте весь SQL из файла `supabase-schema.sql` и выполните его.
7. В разделе **Authentication → Sign In / Providers → Email** убедитесь, что email/password вход включен.
8. Если включено подтверждение email, добавьте адрес локальной разработки в **Authentication → URL Configuration → Site URL**:

```text
http://localhost:5173
```

9. Запустите приложение командой `npm run dev`, зарегистрируйтесь по email и войдите.
10. Для публикации на GitHub Pages также добавьте production-адрес Pages в Supabase Auth URL Configuration, чтобы подтверждение email и редиректы работали корректно.

## Структура таблицы Supabase

SQL-схема находится в `supabase-schema.sql` и создает таблицу `public.cars` со следующими группами полей:

- `id`, `user_id`, `created_at`, `updated_at` — идентификаторы и аудит;
- `vin`, `make`, `model`, `year`, `status`, `photo`, `notes` — описание автомобиля;
- `purchase_date`, `purchase_price`, `delivery_cost`, `repair_cost`, `parts_cost`, `extra_expenses` — покупка и вложения;
- `planned_sale_price`, `actual_sale_price`, `sale_date`, `buyer_contact` — продажа;
- RLS-политики `select`, `insert`, `update`, `delete` разрешают пользователю работать только со строками, где `user_id = auth.uid()`.

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
