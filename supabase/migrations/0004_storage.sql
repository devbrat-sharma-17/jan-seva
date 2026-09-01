-- ============================================================
-- JAN-SEVA — object storage (spec §24, §89)
-- ============================================================
-- Photos leave the database. A base64 data URL inside a record was the
-- prototype's 5 MB ceiling and would be a 400 kB row read on every list
-- query in production.
--
-- Two buckets, because two different things are being protected:
--
--   civic-evidence   the originals. Citizen photos and resolution
--                    evidence. PRIVATE. Reached only through a signed
--                    URL minted by an API function that has already
--                    checked the caller's scope.
--   civic-public     the blurred, downscaled stand-ins the public
--                    tracking page already renders. PUBLIC, because
--                    that is what "anyone with the ticket ID" means,
--                    and they carry no faces, plates or doorways.
--
-- The split matters: `PublicComplaint.protectedPhotos` exists in the
-- type system today for exactly this reason, and putting both in one
-- bucket would make the type-level guarantee unenforceable at rest.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('civic-evidence', 'civic-evidence', false, 12582912,
   array['image/jpeg','image/png','image/webp']),
  ('civic-public', 'civic-public', true, 2097152,
   array['image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Note the MIME allow-list above: no image/svg+xml. An SVG is a script
-- container, and nothing in this product needs one (spec §25). The
-- bucket refusing it is the backstop; the upload endpoint still sniffs
-- the file signature rather than trusting the declared type, because a
-- declared Content-Type is just a string the client chose.

-- ------------------------------------------------------------
-- civic-evidence — private
-- ------------------------------------------------------------
--
-- Object keys are laid out as:  <complaint_id>/<kind>/<uuid>.jpg
-- so the first path segment is the complaint, and a policy can join
-- through it to the department that owns the record.

create policy evidence_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'civic-evidence'
    and exists (
      select 1 from complaints c
      where c.id = (storage.foldername(name))[1]
        and auth_can_access_department(c.department_id)
    )
  );

-- Uploads do NOT go direct to the bucket. Resolution evidence has to be
-- hashed, checked for reuse, distance-checked against the complaint and
-- graded before it counts as evidence (spec §30-§34), and a direct
-- client write would land bytes that skipped all of it. The API function
-- uploads with service_role after those checks pass, so there is no
-- insert policy here at all.

-- ------------------------------------------------------------
-- civic-public — public read
-- ------------------------------------------------------------

create policy public_previews_read on storage.objects
  for select to public
  using (bucket_id = 'civic-public');

-- Same reasoning: previews are DERIVED by the server from an accepted
-- original. Nothing writes to this bucket except service_role, so an
-- unblurred photo cannot be placed in the public bucket by a client.
