-- Run this in the Supabase SQL editor before running load_police_stations.py

create table public.police_stations (
  district      text primary key,
  district_name text,
  address       text,
  zip           text,
  website       text,
  phone         text,
  lat           double precision,
  lng           double precision
);

alter table public.police_stations enable row level security;

create policy "police_stations are publicly readable"
  on public.police_stations for select
  using (true);
