-- Car Flip Manager: exchange support migration for existing Supabase projects.
-- Run in Supabase Dashboard → SQL Editor when cars was created before exchange support.

alter table public.cars drop constraint if exists cars_status_check;
alter table public.cars add constraint cars_status_check
  check (status in ('bought', 'repair', 'sale', 'sold', 'exchanged'));

alter table public.cars add column if not exists acquisition_type text not null default 'purchase';
alter table public.cars add column if not exists exchange_payment_type text not null default 'none';
alter table public.cars add column if not exists exchange_payment_amount numeric default 0;
alter table public.cars add column if not exists exchange_comment text default '';
alter table public.cars add column if not exists exchange_previous_car_id uuid references public.cars(id) on delete set null;
alter table public.cars add column if not exists exchange_next_car_id uuid references public.cars(id) on delete set null;
alter table public.cars add column if not exists exchange_source_make text default '';
alter table public.cars add column if not exists exchange_source_model text default '';
alter table public.cars add column if not exists exchange_source_vin text default '';

alter table public.cars drop constraint if exists cars_acquisition_type_check;
alter table public.cars add constraint cars_acquisition_type_check
  check (acquisition_type in ('purchase', 'exchange'));

alter table public.cars drop constraint if exists cars_exchange_payment_type_check;
alter table public.cars add constraint cars_exchange_payment_type_check
  check (exchange_payment_type in ('received', 'paid', 'none'));

create index if not exists cars_exchange_previous_car_id_idx on public.cars (exchange_previous_car_id);
create index if not exists cars_exchange_next_car_id_idx on public.cars (exchange_next_car_id);

notify pgrst, 'reload schema';
