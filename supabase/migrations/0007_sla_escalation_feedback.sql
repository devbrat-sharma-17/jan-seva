-- ============================================================
-- JAN-SEVA — SLA events, escalations and feedback
-- ============================================================
-- Spec §24, §25, §26.
--
-- WHAT THIS ADDS, AND WHY IT IS NOT A DUPLICATE MODEL.
--
-- `complaints` already carries the CURRENT state of all three of these:
-- `sla_due_at` / `sla_state`, `escalated_at` / `escalation_level`, and a
-- `feedback` jsonb blob. That is enough to render a queue and nothing
-- else. It cannot answer:
--
--   when did this breach, and was anyone told?
--   how many times has this been escalated, by whom, and why?
--   did the citizen rate the first repair differently from the second?
--
-- Latest-state columns are a projection; these tables are the history
-- behind them. The columns on `complaints` stay exactly as they are and
-- remain the fast path for queue reads — nothing here replaces them, so
-- there is no second source of truth for "what is the state right now".
--
-- Every table here hangs off `complaints(id)`. Work orders deliberately
-- do NOT appear in this migration: see the note at the foot of the file.

-- ------------------------------------------------------------
-- SLA events (spec §24)
-- ------------------------------------------------------------
-- One row per SLA transition. `due_at` is copied in rather than joined
-- because the deadline itself moves — a reassignment restarts the clock,
-- and a breach recorded against the old deadline must keep the deadline
-- it was actually measured against.

create type sla_event_type as enum (
  'SLA_SET',
  'SLA_AT_RISK',
  'SLA_BREACHED',
  'SLA_MET',
  'ESCALATED'
);

create table sla_events (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  text not null references complaints(id) on delete cascade,
  event_type    sla_event_type not null,

  -- The deadline this event was measured against, as it stood.
  due_at        timestamptz,
  occurred_at   timestamptz not null default now(),

  -- Which run of the clock produced this, so a reassignment's events do
  -- not read as repeated breaches of one deadline.
  cycle         integer not null default 1 check (cycle > 0),

  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),

  -- Demo rows never enter a real aggregate (spec §46).
  is_synthetic  boolean not null default false
);

-- A given cycle transitions to a given state once. A retried job or a
-- double-fired timer must not record two breaches of one deadline.
create unique index sla_events_once_per_cycle_idx
  on sla_events (complaint_id, event_type, cycle);

create index sla_events_complaint_time_idx
  on sla_events (complaint_id, occurred_at desc);

-- The operational query: what breached, most recent first.
create index sla_events_breach_idx
  on sla_events (event_type, occurred_at desc)
  where event_type in ('SLA_BREACHED', 'SLA_AT_RISK');

-- ------------------------------------------------------------
-- Escalations (spec §25)
-- ------------------------------------------------------------

create type escalation_trigger as enum (
  'SLA_BREACH',        -- the clock ran out
  'CITIZEN_REQUEST',   -- a citizen disputed or asked for re-inspection
  'REPEAT_FAILURE',    -- the asset failed again inside the warranty window
  'MANUAL'             -- a human decided
);

create table escalations (
  id              uuid primary key default gen_random_uuid(),
  complaint_id    text not null references complaints(id) on delete cascade,

  -- Roles, not user ids: an escalation travels up a chain of offices,
  -- and the office outlives the person sitting in it.
  from_role       portal_role,
  to_role         portal_role not null,

  trigger_type    escalation_trigger not null,
  reason          text not null,

  -- Who acted, where a human did. Null for a system escalation, which
  -- is honest — inventing an actor for an automatic trigger would put a
  -- name against a decision nobody made.
  raised_by       uuid references portal_users(id) on delete set null,
  acknowledged_by uuid references portal_users(id) on delete set null,

  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at     timestamptz,

  is_synthetic    boolean not null default false,

  -- An escalation cannot be resolved before it was acknowledged, nor
  -- acknowledged before it was raised.
  constraint escalations_ack_after_raise
    check (acknowledged_at is null or acknowledged_at >= created_at),
  constraint escalations_resolved_after_raise
    check (resolved_at is null or resolved_at >= created_at)
);

create index escalations_complaint_idx
  on escalations (complaint_id, created_at desc);

-- The Command Centre's list: what is still open, oldest first, because
-- the oldest unacknowledged escalation is the one that matters.
create index escalations_open_idx
  on escalations (to_role, created_at)
  where acknowledged_at is null;

-- ------------------------------------------------------------
-- Feedback (spec §26)
-- ------------------------------------------------------------
-- The citizen's answer, kept apart from the department's claim.
--
-- A department closing a complaint sets `complaints.resolved_at`. THIS
-- table is the only place a citizen's own verdict is recorded, and the
-- two are never merged — that separation is the product's whole thesis
-- and the reason `citizen_verified` exists as its own column.

create type verification_response as enum (
  'CONFIRMED',              -- the citizen agrees it is fixed
  'DISPUTED',               -- it is not fixed
  'REINSPECTION_REQUESTED', -- fixed badly, look again
  'NO_RESPONSE'             -- the window closed with silence
);

create table feedback (
  id                 uuid primary key default gen_random_uuid(),
  complaint_id       text not null references complaints(id) on delete cascade,

  -- The reporter, as an opaque digest. There is no citizens table and no
  -- raw mobile number here for the same reason as everywhere else
  -- (spec §10): this record must not become a way to look a person up.
  identity_reference text,

  response           verification_response not null,
  rating             integer check (rating between 1 and 5),
  comment            text,

  -- Which resolution attempt this is about. A second repair gets a
  -- second row rather than overwriting the citizen's first answer.
  attempt            integer not null default 1 check (attempt > 0),

  created_at         timestamptz not null default now(),
  is_synthetic       boolean not null default false
);

-- One verdict per attempt. A resubmitted form must not stack ratings.
create unique index feedback_one_per_attempt_idx
  on feedback (complaint_id, attempt);

create index feedback_complaint_idx
  on feedback (complaint_id, created_at desc);

-- Satisfaction reporting reads only rated rows.
create index feedback_rating_idx
  on feedback (rating, created_at desc)
  where rating is not null;

-- ------------------------------------------------------------
-- Row level security (spec §32)
-- ------------------------------------------------------------
-- Same model as 0003: anon reads nothing directly, portal staff are
-- scoped by their portal_users row, service_role goes through the API
-- functions and re-derives scope there. The helpers come from 0003.
--
-- Every policy below is READ-ONLY. Writes to these tables happen in the
-- server functions under service_role, inside the same transaction as
-- the mutation they describe (spec §37) — an officer's session must not
-- be able to write its own SLA history or its own citizen feedback.

alter table sla_events   enable row level security;
alter table escalations  enable row level security;
alter table feedback     enable row level security;

-- Staff see SLA history for complaints their department may access.
create policy sla_events_department_read on sla_events
  for select to authenticated
  using (
    exists (
      select 1 from complaints c
      where c.id = sla_events.complaint_id
        and auth_can_access_department(c.department_id)
    )
  );

create policy escalations_department_read on escalations
  for select to authenticated
  using (
    exists (
      select 1 from complaints c
      where c.id = escalations.complaint_id
        and auth_can_access_department(c.department_id)
    )
  );

/**
 * Feedback is readable by the department it is about — an officer has to
 * be able to see that a citizen disputed their closure, or the dispute
 * is not actionable.
 *
 * `identity_reference` is exposed to nobody by this policy in any useful
 * form: it is a salted digest, and the public projection drops it
 * entirely (spec §34).
 */
create policy feedback_department_read on feedback
  for select to authenticated
  using (
    exists (
      select 1 from complaints c
      where c.id = feedback.complaint_id
        and auth_can_access_department(c.department_id)
    )
  );

-- ------------------------------------------------------------
-- NOT IN THIS MIGRATION: work_orders (spec §18)
-- ------------------------------------------------------------
-- Spec §18 asks for a `work_orders` table keyed to the civic issue, so
-- that three citizens reporting one pothole produce one repair job
-- rather than three (spec §14, §74).
--
-- That is the correct model and this schema does not implement it: work
-- state currently lives on `complaints` as `assigned_to`, `status`,
-- `sla_due_at`. Adding a work_orders table alongside those columns would
-- create exactly the duplicate system spec §8 forbids — two places
-- claiming to know who owns a job.
--
-- Doing it properly means MOVING that state off `complaints` and onto a
-- row keyed by `civic_issue_id`, which changes the shape every existing
-- query and repository reads. It is a restructure of 0001, not an
-- addition to it, and it needs a decision that is not this migration's
-- to make. Flagged rather than guessed at.
