-- Run this in the Supabase SQL editor before running load_shelters.py

create table public.shelters (
  site_id      integer primary key,
  agency       text,
  site_name    text,
  population   text,
  shelter_type text,
  address      text,
  phone        text,
  ward         integer,
  geography    text,
  capacity     integer,
  lat          double precision,
  lng          double precision,
  csv_date     date
);

alter table public.shelters enable row level security;

create policy "shelters are publicly readable"
  on public.shelters for select
  using (true);
