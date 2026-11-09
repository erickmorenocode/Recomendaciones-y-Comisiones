-- Run once in the Supabase SQL editor, after schema.sql.
--
-- Record of each final cut, as section 6 of the Manual requires: date, entry
-- price, exit or market price, and calculation. Projections are not stored.
--
-- RLS is enabled with no policies, same as schema.sql: only API routes using
-- the service role key can reach these tables.

-- One row per trader and cut, with the amounts in USD.
create table commission_cuts (
  id uuid primary key default gen_random_uuid(),
  trader_id smallint not null references traders (id),
  cycle_start date not null,
  cut_number smallint not null check (cut_number in (1, 2)),
  cut_date date not null,
  -- Participation paid in this cut.
  commission numeric(18, 2) not null check (commission >= 0),
  -- Retention in force at this cut. Replaces the previous cut's, does not add to it.
  retention numeric(18, 2) not null check (retention >= 0),
  -- Definitive discount accumulated in the cycle up to this cut.
  definitive_discount numeric(18, 2) not null check (definitive_discount >= 0),
  -- Full engine result for this cut (threshold, realized, market result, net).
  calculation jsonb not null,
  created_at timestamptz not null default now(),
  constraint commission_cuts_one_per_cut unique (trader_id, cycle_start, cut_number),
  constraint commission_cuts_date_in_cycle check (cut_date >= cycle_start)
);

create index commission_cuts_trader_idx on commission_cuts (trader_id, cut_date desc);

-- Positions as they stood at the cut, copied so later edits do not change the record.
create table commission_cut_positions (
  cut_id uuid not null references commission_cuts (id) on delete cascade,
  position_id uuid not null references positions (id),
  ticker text not null,
  buy_date date not null,
  buy_price numeric(18, 4) not null check (buy_price > 0),
  shares numeric(18, 6) not null check (shares > 0),
  -- Sale price if the position was sold by the cut, otherwise the market price on the cut date.
  exit_or_market_price numeric(18, 4) not null check (exit_or_market_price > 0),
  price_source text not null check (price_source in ('venta', 'mercado')),
  primary key (cut_id, position_id)
);

create index commission_cut_positions_position_idx on commission_cut_positions (position_id);

alter table commission_cuts enable row level security;
alter table commission_cut_positions enable row level security;
