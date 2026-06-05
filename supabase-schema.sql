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

create index if not exists cars_user_id_created_at_idx on public.cars (user_id, created_at desc);
create index if not exists cars_user_id_vin_idx on public.cars (user_id, vin);

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

alter table public.cars enable row level security;

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
