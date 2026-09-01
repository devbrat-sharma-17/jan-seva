-- ============================================================
-- JAN-SEVA — reference data
-- ============================================================
-- REFERENCE data only: the city and its departments. These are real,
-- publicly published municipal facts and they belong in every
-- environment including production.
--
-- What is NOT here, deliberately (spec §95, §96):
--
--   * complaints — not one. A production database starts empty. The
--     synthetic Gwalior history stays in src/data/seedComplaints.ts,
--     loaded only in demo and development builds.
--   * staff accounts — no officer rows, no admin row. Real department
--     accounts are created explicitly by an administrator against
--     Supabase Auth. Seeding "Er. Ramesh Verma" here would put a
--     fabricated officer's name on real citizens' complaints.
--   * civic assets — the asset registry is synthetic and is loaded by
--     the demo seeding script, which sets is_synthetic = true on every
--     row it writes.
--
-- Helplines below are the ones already published in the application's
-- department configuration. They are carried across rather than
-- invented; verify them against the corporation's current directory
-- before the beta goes public, because a wrong helpline on a civic
-- portal is worse than none.

insert into cities (id, code, name, name_hindi, state, centre_lat, centre_lng, is_active)
values
  ('gwalior', 'GWL', 'Gwalior', 'ग्वालियर', 'Madhya Pradesh', 26.2183, 78.1828, true)
on conflict (id) do nothing;

-- Indore and Bhopal exist as "coming soon" screens in the app. They are
-- inserted inactive so city selection has something real to point at,
-- and so no complaint can be filed against a city with no departments.
insert into cities (id, code, name, name_hindi, state, centre_lat, centre_lng, is_active)
values
  ('indore', 'IND', 'Indore', 'इंदौर', 'Madhya Pradesh', 22.7196, 75.8577, false),
  ('bhopal', 'BPL', 'Bhopal', 'भोपाल', 'Madhya Pradesh', 23.2599, 77.4126, false)
on conflict (id) do nothing;

insert into departments (id, city_id, name, short_name, helpline, categories, divisions)
values
  ('roads', 'gwalior', 'Public Works Department', 'Public Works', '0751-2441234',
   array['roads','potholes','footpath'],
   array['Road Maintenance','Bridges & Culverts','Footpaths']),

  ('sanitation', 'gwalior', 'Municipal Sanitation Department', 'Sanitation', '0751-2442222',
   array['garbage','drainage','sewage'],
   array['Solid Waste','Drainage','Public Toilets']),

  ('water', 'gwalior', 'Water Services Department', 'Water Services', '0751-2443333',
   array['water-supply','leakage','contamination'],
   array['Supply Network','Leak Repair','Quality Control']),

  ('electrical', 'gwalior', 'Electrical & Streetlight Department', 'Electrical', '0751-2444444',
   array['streetlight','electrical-hazard'],
   array['Streetlighting','Substations','Hazard Response']),

  ('infrastructure', 'gwalior', 'Urban Infrastructure Department', 'Infrastructure', '0751-2445555',
   array['parks','encroachment','public-property'],
   array['Parks & Gardens','Encroachment','Civic Structures'])
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Ticket sequence
-- ------------------------------------------------------------
-- Complaint IDs are generated in the browser today from a counter in
-- localStorage, which two devices filing at once would collide on. The
-- server issues them from here instead: one row per city per year, one
-- atomic increment.

create table if not exists ticket_sequences (
  city_id  text not null references cities(id) on delete restrict,
  year     integer not null,
  last_value integer not null default 0,
  primary key (city_id, year)
);

alter table ticket_sequences enable row level security;
-- No policy: only the server issues ticket numbers.

/**
 * Next complaint ID for a city, e.g. 'JS-GWL-2026-001284'.
 *
 * The UPDATE takes a row lock, so two concurrent submissions serialise
 * on it and cannot receive the same number — which is the failure the
 * localStorage counter has today and cannot fix.
 */
create or replace function next_complaint_id(p_city_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year  integer := extract(year from now() at time zone 'Asia/Kolkata');
  v_code  text;
  v_next  integer;
begin
  select code into v_code from cities where id = p_city_id;
  if v_code is null then
    raise exception 'unknown city: %', p_city_id;
  end if;

  insert into ticket_sequences (city_id, year, last_value)
  values (p_city_id, v_year, 1)
  on conflict (city_id, year)
    do update set last_value = ticket_sequences.last_value + 1
  returning last_value into v_next;

  return format('JS-%s-%s-%s', v_code, v_year, lpad(v_next::text, 6, '0'));
end;
$$;
