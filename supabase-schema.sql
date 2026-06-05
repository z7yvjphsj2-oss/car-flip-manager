-- Car Flip Manager Supabase schema
-- Run this SQL in Supabase Dashboard → SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  vin text not null,
  make text not null,
  model text not null,
  year text default '',
  purchase_date date,
  purchase_price numeric default 0,
  delivery_cost numeric default 0,
  repair_cost numeric default 0,
  parts_cost numeric default 0,
  extra_expenses numeric default 0,
  planned_sale_price numeric default 0,
  actual_sale_price numeric default 0,
  sale_date date,
  buyer_contact text default '',
  notes text default '',
  status text not null default 'bought' check (status in ('bought', 'repair', 'sale', 'sold')),
  photo text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  expense_type text not null default 'other' check (expense_type in ('purchase', 'delivery', 'repair', 'parts', 'other')),
  title text not null default '',
  amount numeric not null default 0,
  expense_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  planned_sale_price numeric default 0,
  actual_sale_price numeric default 0,
  sale_date date,
  buyer_contact text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (car_id)
);

create index if not exists cars_user_id_created_at_idx on public.cars (user_id, created_at desc);
create index if not exists cars_user_id_vin_idx on public.cars (user_id, vin);
create index if not exists expenses_user_id_car_id_idx on public.expenses (user_id, car_id);
create index if not exists expenses_car_id_created_at_idx on public.expenses (car_id, created_at desc);
create index if not exists notes_user_id_car_id_idx on public.notes (user_id, car_id);
create index if not exists notes_car_id_created_at_idx on public.notes (car_id, created_at desc);
create index if not exists sales_user_id_car_id_idx on public.sales (user_id, car_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cars_set_updated_at on public.cars;
create trigger cars_set_updated_at
before update on public.cars
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists sales_set_updated_at on public.sales;
create trigger sales_set_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

alter table public.cars enable row level security;
alter table public.expenses enable row level security;
alter table public.notes enable row level security;
alter table public.sales enable row level security;

drop policy if exists "Users can view their own cars" on public.cars;
drop policy if exists "Users can add their own cars" on public.cars;
drop policy if exists "Users can update their own cars" on public.cars;
drop policy if exists "Users can delete their own cars" on public.cars;

create policy "Users can view their own cars"
  on public.cars
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own cars"
  on public.cars
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own cars"
  on public.cars
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own cars"
  on public.cars
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own expenses" on public.expenses;
drop policy if exists "Users can add their own expenses" on public.expenses;
drop policy if exists "Users can update their own expenses" on public.expenses;
drop policy if exists "Users can delete their own expenses" on public.expenses;

create policy "Users can view their own expenses"
  on public.expenses
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = expenses.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can add their own expenses"
  on public.expenses
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = expenses.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can update their own expenses"
  on public.expenses
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = expenses.car_id and cars.user_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = expenses.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can delete their own expenses"
  on public.expenses
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = expenses.car_id and cars.user_id = (select auth.uid()))
  );

drop policy if exists "Users can view their own notes" on public.notes;
drop policy if exists "Users can add their own notes" on public.notes;
drop policy if exists "Users can update their own notes" on public.notes;
drop policy if exists "Users can delete their own notes" on public.notes;

create policy "Users can view their own notes"
  on public.notes
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = notes.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can add their own notes"
  on public.notes
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = notes.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can update their own notes"
  on public.notes
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = notes.car_id and cars.user_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = notes.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can delete their own notes"
  on public.notes
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = notes.car_id and cars.user_id = (select auth.uid()))
  );

drop policy if exists "Users can view their own sales" on public.sales;
drop policy if exists "Users can add their own sales" on public.sales;
drop policy if exists "Users can update their own sales" on public.sales;
drop policy if exists "Users can delete their own sales" on public.sales;

create policy "Users can view their own sales"
  on public.sales
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = sales.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can add their own sales"
  on public.sales
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = sales.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can update their own sales"
  on public.sales
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = sales.car_id and cars.user_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = sales.car_id and cars.user_id = (select auth.uid()))
  );

create policy "Users can delete their own sales"
  on public.sales
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.cars where cars.id = sales.car_id and cars.user_id = (select auth.uid()))
  );
