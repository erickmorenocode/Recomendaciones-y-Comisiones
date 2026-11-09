-- Run once, after commission_cuts.sql.
--
-- Section 7 of the Manual: the daily job proposes each fault here and a person
-- confirms or dismisses it. RLS has no policies: only API routes reach this table.

-- A cycle keeps generating cuts while it has open positions, so beyond month 12.
alter table commission_cuts drop constraint commission_cuts_cut_number_check;
alter table commission_cuts add constraint commission_cuts_cut_number_check check (cut_number >= 1);

create table risk_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trader_id smallint not null references traders (id),
  -- Null for events about the whole portfolio.
  position_id uuid references positions (id),
  ticker text,
  cycle_start date not null,
  event text not null check (event in ('posicion_20', 'portafolio_40', 'corte_todo_perdida')),
  event_date date not null,
  detail text not null,
  proposed_grade smallint not null check (proposed_grade between 1 and 3),
  status text not null default 'pendiente' check (status in ('pendiente', 'confirmada', 'descartada')),
  resolved_at timestamptz,
  block_lifted_at timestamptz,
  -- Stops the daily job from proposing the same event twice, even after a dismissal.
  dedupe_key text not null unique
);

create index risk_alerts_trader_idx on risk_alerts (trader_id, created_at desc);

create function log_risk_alert_movement() returns trigger
language plpgsql set search_path = public as $$
declare
  movement_action text;
begin
  if tg_op = 'INSERT' then
    movement_action := 'alerta_generada';
  elsif old.status = 'pendiente' and new.status = 'confirmada' then
    movement_action := 'falta_confirmada';
  elsif old.status = 'pendiente' and new.status = 'descartada' then
    movement_action := 'falta_descartada';
  elsif old.block_lifted_at is null and new.block_lifted_at is not null then
    movement_action := 'bloqueo_levantado';
  else
    return new;
  end if;

  insert into movements (trader_id, position_id, action, ticker, before, after)
  values (
    new.trader_id,
    new.position_id,
    movement_action,
    new.ticker,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger risk_alerts_log after insert or update on risk_alerts
for each row execute function log_risk_alert_movement();

create trigger risk_alerts_no_delete before delete on risk_alerts
for each row execute function reject_history_change();

alter table risk_alerts enable row level security;
