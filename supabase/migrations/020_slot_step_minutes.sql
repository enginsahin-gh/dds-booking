-- Add calendar slot step setting (15 or 30 minutes)
alter table salons
  add column if not exists slot_step_minutes integer not null default 15;

update salons
  set slot_step_minutes = 15
  where slot_step_minutes is null;

alter table salons
  add constraint slot_step_minutes_check
  check (slot_step_minutes in (15, 30));
