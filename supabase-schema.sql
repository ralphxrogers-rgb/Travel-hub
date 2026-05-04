-- ============================================================
-- Travel Hub — Supabase Schema
-- Run this in your Supabase project: SQL Editor > New Query
-- ============================================================

-- Trips table
create table if not exists trips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  destination text not null,
  country text,
  start_date date,
  end_date date,
  status text check (status in ('planning','confirmed','completed','cancelled')) default 'planning',
  hotel text,
  booking_ref text,
  notes text,
  points_used integer default 0,
  points_program text,
  created_at timestamptz default now()
);

-- Documents table
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text check (type in ('passport','visa','insurance','membership','license','other')) default 'other',
  doc_number text,
  issued_date date,
  expiry_date date,
  issuing_country text,
  notes text,
  file_url text,
  created_at timestamptz default now()
);

-- Loyalty accounts table
create table if not exists loyalty_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  program text not null,
  member_id text,
  points_balance integer default 0,
  tier text,
  expiry_date date,
  notes text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Itinerary items table
create table if not exists itinerary_items (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  item_date date,
  item_time time,
  title text not null,
  description text,
  location text,
  category text check (category in ('flight','hotel','train','car','activity','dining','transport','other')) default 'activity',
  booking_ref text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Reservations table (AI-extracted from uploaded files)
create table if not exists reservations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  trip_id uuid references trips(id) on delete set null,
  type text check (type in ('flight','hotel','car','train','activity','dining','transport','other')) default 'other',
  vendor text,
  confirmation_number text,
  start_date date,
  end_date date,
  start_time time,
  location text,
  notes text,
  file_path text,
  file_name text,
  created_at timestamptz default now()
);

-- Enable Row Level Security on all tables
alter table trips enable row level security;
alter table documents enable row level security;
alter table loyalty_accounts enable row level security;
alter table itinerary_items enable row level security;
alter table reservations enable row level security;

-- RLS Policies — users can only access their own data
create policy "trips: users own data" on trips for all using (auth.uid() = user_id);
create policy "documents: users own data" on documents for all using (auth.uid() = user_id);
create policy "loyalty_accounts: users own data" on loyalty_accounts for all using (auth.uid() = user_id);
create policy "itinerary_items: users own data" on itinerary_items for all using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists trips_user_id_idx on trips(user_id);
create index if not exists trips_start_date_idx on trips(start_date);
create index if not exists documents_user_id_idx on documents(user_id);
create index if not exists documents_expiry_idx on documents(expiry_date);
create index if not exists loyalty_user_id_idx on loyalty_accounts(user_id);
create index if not exists itinerary_trip_id_idx on itinerary_items(trip_id);
create policy "reservations: users own data" on reservations for all using (auth.uid() = user_id);
create index if not exists reservations_user_id_idx on reservations(user_id);
create index if not exists reservations_trip_id_idx on reservations(trip_id);
