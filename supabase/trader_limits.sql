-- Run once, after risk_alerts.sql.
--
-- Each trader has an editable base limit between USD 25,000 and 300,000. The
-- incentive multiplies it: 0.2 once unlocked and applied, 0.5 when the higher
-- tier is reached.

alter table traders
  add column max_recommended numeric(18, 2) not null default 200000
    check (max_recommended between 25000 and 300000),
  add column incentive_rate numeric(3, 2) not null default 0 check (incentive_rate in (0, 0.2, 0.5));
