-- Supabase schema for Adinn Design Work Allocation
-- Run this once in Supabase Dashboard -> SQL Editor before setting Render env vars.

create table if not exists public.app_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- The backend uses a Supabase secret/service role key, which can bypass RLS.
-- Do not grant browser roles direct access to this internal application state.
revoke all on table public.app_state from anon;
revoke all on table public.app_state from authenticated;

create index if not exists app_state_updated_at_idx
  on public.app_state (updated_at desc);
