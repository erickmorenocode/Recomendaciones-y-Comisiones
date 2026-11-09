-- Run once in the Supabase SQL editor of this project.
--
-- RLS is enabled with no policies on every table, so the anon key has no access.
-- The app reaches these tables only from API routes, with the service role key.

create table app_settings (
  id smallint primary key default 1 check (id = 1),
  cycle_start date
);

insert into app_settings (id) values (1);

create table traders (
  id smallint primary key check (id between 1 and 11),
  name text not null check (length(trim(name)) > 0)
);

insert into traders (id, name)
select n, 'Trader ' || n from generate_series(1, 11) as n;

create table positions (
  id uuid primary key default gen_random_uuid(),
  trader_id smallint not null references traders (id),
  ticker text not null,
  company_name text not null,
  buy_price numeric(18, 4) not null check (buy_price > 0),
  shares numeric(18, 6) not null check (shares > 0),
  buy_date date not null,
  sell_price numeric(18, 4) check (sell_price > 0),
  sell_date date,
  deleted_at timestamptz,
  constraint positions_sale_complete check ((sell_price is null) = (sell_date is null)),
  constraint positions_sale_after_buy check (sell_date is null or sell_date >= buy_date)
);

create index positions_trader_idx on positions (trader_id, buy_date desc);

-- Movement history. Written only by the triggers below, so a change and its
-- history row commit together and no code path can skip the log.
create table movements (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  trader_id smallint references traders (id),
  position_id uuid references positions (id),
  action text not null,
  ticker text,
  before jsonb,
  after jsonb
);

create index movements_trader_idx on movements (trader_id, id desc);

create function log_position_movement() returns trigger
language plpgsql set search_path = public as $$
declare
  movement_action text;
begin
  if tg_op = 'INSERT' then
    movement_action := 'compra_registrada';
  elsif old.deleted_at is null and new.deleted_at is not null then
    movement_action := 'compra_eliminada';
  elsif old.sell_date is null and new.sell_date is not null then
    movement_action := 'venta_registrada';
  elsif old.sell_date is not null and new.sell_date is null then
    movement_action := 'venta_revertida';
  elsif old.sell_date is distinct from new.sell_date or old.sell_price is distinct from new.sell_price then
    movement_action := 'venta_editada';
  else
    movement_action := 'compra_editada';
  end if;

  insert into movements (trader_id, position_id, action, ticker, before, after)
  values (
    new.trader_id,
    new.id,
    movement_action,
    new.ticker,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger positions_insert_log after insert on positions
for each row execute function log_position_movement();

create trigger positions_update_log after update on positions
for each row when (old is distinct from new) execute function log_position_movement();

create function log_trader_movement() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into movements (trader_id, action, before, after)
  values (new.id, 'perfil_editado', to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

create trigger traders_update_log after update on traders
for each row when (old is distinct from new) execute function log_trader_movement();

create function log_settings_movement() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into movements (action, before, after)
  values ('ciclo_editado', to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

create trigger settings_update_log after update on app_settings
for each row when (old is distinct from new) execute function log_settings_movement();

create function reject_history_change() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'History is append-only: % on % is not allowed', tg_op, tg_table_name;
end;
$$;

create trigger movements_append_only before update or delete on movements
for each row execute function reject_history_change();

create trigger positions_no_hard_delete before delete on positions
for each row execute function reject_history_change();

alter table app_settings enable row level security;
alter table traders enable row level security;
alter table positions enable row level security;
alter table movements enable row level security;
