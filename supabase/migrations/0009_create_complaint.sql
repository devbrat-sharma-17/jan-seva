-- ============================================================
-- JAN-SEVA — atomic complaint creation
-- ============================================================
-- Spec phases 3-7: one transaction, server-issued ID, server-side
-- routing, idempotent under retry.
--
-- WHY THIS IS A DATABASE FUNCTION AND NOT FIVE POSTGREST CALLS
-- ------------------------------------------------------------
-- Creating a complaint writes five rows: a civic issue, the complaint,
-- a timeline event, an audit event and the idempotency ledger. Over
-- PostgREST each of those is its OWN transaction. A failure after row
-- three leaves a complaint with no audit trail and an orphaned issue,
-- and there is no way to roll it back from the client. A plpgsql
-- function is atomic by construction: it commits all five or none.
--
-- The endpoint therefore makes exactly one call. That is the whole
-- point — "do not fake transactions by sequential client requests".

-- ------------------------------------------------------------
-- FIRST: correct the routing configuration
-- ------------------------------------------------------------
-- 0005 seeded categories from the municipal department descriptions
-- ('potholes', 'water-supply', 'streetlight'). The application's actual
-- category vocabulary is the six ids in src/data/issueCategories.ts
-- ('roads', 'garbage', 'water', 'streetlights', 'infrastructure',
-- 'others'). They overlap almost nowhere, so routing a real submission
-- off this column would have matched nothing and sent every complaint
-- to general triage.
--
-- The app's vocabulary wins: it is what the citizen actually picks.

update departments set categories = array['roads']          where id = 'roads';
update departments set categories = array['garbage']        where id = 'sanitation';
update departments set categories = array['water']          where id = 'water';
update departments set categories = array['streetlights']   where id = 'electrical';
update departments set categories = array['infrastructure'] where id = 'infrastructure';

-- 'others' is deliberately assigned to NO department. It is the category
-- a citizen picks when the five do not fit, and guessing a department
-- for it produces confidently-wrong routing. It lands in general triage
-- (department_id null), which admins and nodal officers work and which
-- complaints_triage_read in 0003 already scopes correctly.

-- ------------------------------------------------------------
-- Routing
-- ------------------------------------------------------------
/**
 * The department that owns a category, in a city. NULL is a legitimate
 * answer meaning "general triage", not a failure.
 *
 * This is CONFIGURATION LOOKUP, not intelligence. It is a table read.
 * Nothing here is AI and nothing should ever describe it as such.
 */
create or replace function route_department(p_city_id text, p_category text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from departments d
  where d.city_id = p_city_id
    and d.is_active
    and p_category = any (d.categories)
  limit 1
$$;

-- ------------------------------------------------------------
-- Creation
-- ------------------------------------------------------------
/**
 * Creates one citizen complaint, atomically and idempotently.
 *
 * IDEMPOTENCY uses the existing sync_operations ledger (0001), which was
 * built for exactly this: "a retry that reaches the server twice must
 * not produce two timeline events". The key is the primary key, so two
 * concurrent retries race on an insert and the loser reads the winner's
 * result instead of writing a second complaint. No new table.
 *
 * LOCATION. Two coordinates, never conflated (spec §37):
 *   p_lat / p_lng          the CONFIRMED issue location. Routing, GIS
 *                          and asset snapping all use this.
 *   p_gps_lat / p_gps_lng  where the device was. Evidence only. Never
 *                          overwrites the confirmed location.
 *
 * Everything the client sends is treated as untrusted. The ticket id,
 * the department, the status and every timestamp are decided here.
 */
create or replace function create_complaint(
  p_idempotency_key   text,
  p_city_id           text,
  p_category          text,
  p_title             text,
  p_description       text,
  p_lat               double precision,
  p_lng               double precision,
  p_locality          text default null,
  p_address           text default null,
  p_location_source   text default 'gps',
  p_gps_lat           double precision default null,
  p_gps_lng           double precision default null,
  p_gps_accuracy_m    double precision default null,
  p_gps_captured_at   timestamptz default null,
  p_identity_reference text default null,
  p_identity_method   identity_method default null,
  p_identity_masked   text default null,
  p_identity_verified boolean default false,
  p_severity          severity_level default 'medium',
  p_priority_score    integer default 50,
  p_sla_hours         integer default 48,
  p_is_synthetic      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing    jsonb;
  v_ticket      text;
  v_department  text;
  v_issue_id    uuid;
  v_now         timestamptz := now();
  v_sla_due     timestamptz;
  v_result      jsonb;
begin
  -- ----------------------------------------------------------
  -- 0. Replay?
  -- ----------------------------------------------------------
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key_required' using errcode = 'check_violation';
  end if;

  select result into v_existing
  from sync_operations
  where idempotency_key = p_idempotency_key;

  if v_existing is not null then
    -- Same submission, already applied. Return what it produced and
    -- write nothing: the caller cannot tell a retry from the original,
    -- which is exactly the contract.
    return v_existing || jsonb_build_object('replayed', true);
  end if;

  -- ----------------------------------------------------------
  -- 1. Validate. Server-side, because the client is untrusted.
  -- ----------------------------------------------------------
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid_coordinates' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from cities where id = p_city_id and is_active) then
    -- Covers both "unknown city" and "city not open for reports yet",
    -- which is what keeps Indore and Bhopal from accepting complaints
    -- while they are still coming-soon screens.
    raise exception 'city_not_active' using errcode = 'check_violation';
  end if;

  if p_category is null or length(btrim(p_category)) = 0 then
    raise exception 'category_required' using errcode = 'check_violation';
  end if;

  if length(coalesce(p_description, '')) > 5000 then
    raise exception 'description_too_long' using errcode = 'check_violation';
  end if;

  -- ----------------------------------------------------------
  -- 2. Route. The client does not get a say.
  -- ----------------------------------------------------------
  v_department := route_department(p_city_id, p_category);
  v_sla_due := v_now + make_interval(hours => greatest(p_sla_hours, 1));

  -- ----------------------------------------------------------
  -- 3. Ticket id, issued here and nowhere else.
  -- ----------------------------------------------------------
  v_ticket := next_complaint_id(p_city_id);

  -- ----------------------------------------------------------
  -- 4. Find or open the civic issue (spec §9).
  -- ----------------------------------------------------------
  -- One pothole, many reports. An open issue of the same category
  -- within 50 m is treated as the same physical problem. Uses the GIST
  -- index from 0002 rather than scanning.
  select ci.id into v_issue_id
  from civic_issues ci
  where ci.city_id = p_city_id
    and ci.category = p_category
    and ci.status not in ('resolved')
    and st_dwithin(
          ci.geog,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          50
        )
  order by ci.geog <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit 1;

  if v_issue_id is null then
    insert into civic_issues (
      reference, city_id, department_id, category, title,
      lat, lng, locality, report_count, first_reported_at
    ) values (
      v_ticket || '-I', p_city_id, v_department, p_category,
      coalesce(nullif(btrim(p_title), ''), 'Civic issue'),
      p_lat, p_lng, p_locality, 1, v_now
    )
    returning id into v_issue_id;
  else
    update civic_issues
       set report_count = report_count + 1, updated_at = v_now
     where id = v_issue_id;
  end if;

  -- ----------------------------------------------------------
  -- 5. The complaint.
  -- ----------------------------------------------------------
  insert into complaints (
    id, city_id, civic_issue_id, status, moderation, department_id,
    category, severity, priority_score,
    lat, lng, location_source,
    gps_lat, gps_lng, gps_accuracy_m, gps_captured_at,
    formatted_address, locality,
    identity_reference, identity_method, identity_masked, identity_verified,
    sla_due_at, sla_state, issue, version, created_at, updated_at, is_synthetic
  ) values (
    v_ticket, p_city_id, v_issue_id, 'pending', 'normal', v_department,
    p_category, p_severity, least(greatest(p_priority_score, 0), 100),
    p_lat, p_lng, coalesce(p_location_source, 'gps'),
    p_gps_lat, p_gps_lng, p_gps_accuracy_m, p_gps_captured_at,
    p_address, p_locality,
    p_identity_reference, p_identity_method, p_identity_masked,
    coalesce(p_identity_verified, false),
    v_sla_due, 'normal',
    jsonb_build_object('title', p_title, 'description', p_description),
    0, v_now, v_now, coalesce(p_is_synthetic, false)
  );

  -- ----------------------------------------------------------
  -- 6. Timeline — citizen-visible.
  -- ----------------------------------------------------------
  insert into timeline_events (complaint_id, occurred_at, status, title, description, actor_label, actor_type, visibility)
  values (
    v_ticket, v_now, 'pending', 'Complaint received',
    'Report submitted through JAN-SEVA.', 'Citizen Portal', 'citizen', 'public'
  );

  if v_department is not null then
    insert into timeline_events (complaint_id, occurred_at, status, title, description, actor_label, actor_type, visibility)
    values (
      v_ticket, v_now, 'pending',
      'Routed to ' || (select short_name from departments where id = v_department),
      -- Says what it is. This is a configuration lookup on the category,
      -- and calling it anything cleverer would be a lie in the citizen's
      -- own timeline.
      'Matched from the reported category, with a ' || p_sla_hours || '-hour turnaround target.',
      'JAN-SEVA Routing', 'system', 'public'
    );
  else
    insert into timeline_events (complaint_id, occurred_at, status, title, description, actor_label, actor_type, visibility)
    values (
      v_ticket, v_now, 'pending', 'Awaiting routing',
      'This report is in the general triage queue for assignment.',
      'JAN-SEVA Routing', 'system', 'public'
    );
  end if;

  -- ----------------------------------------------------------
  -- 7. Audit — internal, append-only.
  -- ----------------------------------------------------------
  insert into audit_events (occurred_at, actor_label, action, entity_type, entity_id, detail)
  values (
    v_now, 'citizen', 'complaint.create', 'complaint', v_ticket,
    -- No identifier, no coordinates, no description. An audit row is a
    -- record that something happened, not a second copy of the report.
    jsonb_build_object(
      'category', p_category,
      'department', v_department,
      'identity_verified', coalesce(p_identity_verified, false)
    )
  );

  v_result := jsonb_build_object(
    'complaintId', v_ticket,
    'civicIssueId', v_issue_id,
    'departmentId', v_department,
    'status', 'pending',
    'slaDueAt', v_sla_due,
    'createdAt', v_now,
    'replayed', false
  );

  -- ----------------------------------------------------------
  -- 8. Seal the idempotency key, inside the same transaction.
  -- ----------------------------------------------------------
  insert into sync_operations (idempotency_key, operation_type, entity_id, status, result, received_at)
  values (p_idempotency_key, 'complaint.create', v_ticket, 'applied', v_result, v_now);

  return v_result;
exception
  when unique_violation then
    -- Two retries raced and the other one won between our SELECT and our
    -- INSERT. The transaction rolls back; read the winner's result and
    -- return it, so both callers see the same complaint.
    select result into v_existing from sync_operations where idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return v_existing || jsonb_build_object('replayed', true);
    end if;
    raise;
end;
$$;

-- Server-only. A browser able to call this could mint complaints without
-- passing through validation, rate limiting or screening.
revoke execute on function create_complaint(
  text, text, text, text, text, double precision, double precision, text, text, text,
  double precision, double precision, double precision, timestamptz,
  text, identity_method, text, boolean, severity_level, integer, integer, boolean
) from public, anon, authenticated;

revoke execute on function route_department(text, text) from public, anon, authenticated;

grant execute on function create_complaint(
  text, text, text, text, text, double precision, double precision, text, text, text,
  double precision, double precision, double precision, timestamptz,
  text, identity_method, text, boolean, severity_level, integer, integer, boolean
) to service_role;

grant execute on function route_department(text, text) to service_role;
