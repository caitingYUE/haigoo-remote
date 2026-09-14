-- Apply before the matching-reminder backend. Existing data and authorizations are retained.
-- Reuse the saved Match profile: explicit role terms narrow all source modes,
-- including resume/mixed profiles. Missing/paused profiles never match.
CREATE OR REPLACE FUNCTION mini_reminder_role_matches(p JSONB, families JSONB, title TEXT, category TEXT)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(p->>'status'='active' AND COALESCE((p->>'in_app_enabled')::boolean,TRUE)
   AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(families,'[]'::jsonb)) r(value)
     WHERE COALESCE(p->'role_families','[]'::jsonb) ? r.value)
   AND (jsonb_array_length(COALESCE(p->'custom_role_terms','[]'::jsonb))=0
     OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'custom_role_terms') t(value)
       WHERE length(regexp_replace(lower(t.value),'[[:space:]/\\|·,，、()（）_-]+','','g'))>0
         AND strpos(regexp_replace(lower(concat_ws(' ',title,category)),'[[:space:]/\\|·,，、()（）_-]+','','g'),
           regexp_replace(lower(t.value),'[[:space:]/\\|·,，、()（）_-]+','','g'))>0)),FALSE)
$$;

CREATE OR REPLACE VIEW mini_reminder_deliverable AS
 SELECT inbox.inbox_id,inbox.user_id,inbox.attempt_count,inbox.authorization_id,inbox.authorization_source,
   events.company_id,events.occurred_at,companies.name AS company_name,companies.industry,
   jobs.title AS job_title,COALESCE(NULLIF(BTRIM(jobs.location),''),NULLIF(BTRIM(jobs.region),'')) AS job_location,
   jobs.job_type,identities.app_id,identities.openid
 FROM mini_company_update_inbox inbox
 JOIN mini_company_update_events events ON events.event_id=inbox.event_id
 JOIN trusted_companies companies ON companies.company_id=events.company_id
 JOIN jobs ON jobs.job_id=events.source_job_id
 JOIN users ON users.user_id=inbox.user_id AND users.status='active'
 JOIN mini_wechat_identities identities ON identities.user_id=users.user_id
 LEFT JOIN mini_company_follows follows ON follows.user_id=inbox.user_id AND follows.company_id=events.company_id
 LEFT JOIN career_watch_profiles profiles ON profiles.user_id=inbox.user_id
 WHERE events.has_public_opportunity=TRUE AND mini_job_is_public(to_jsonb(jobs),to_jsonb(companies))
   AND (jobs.company_id=companies.company_id OR (jobs.company_id IS NULL AND lower(btrim(jobs.company))=lower(btrim(companies.name))))
   AND COALESCE(jobs.title,'')=COALESCE(events.job_snapshot->>'title','')
   AND COALESCE(jobs.category,'')=COALESCE(events.job_snapshot->>'category','')
   AND mini_reminder_role_matches(to_jsonb(profiles),events.role_families,jobs.title,jobs.category)
   AND ((inbox.authorization_source='follow' AND follows.status='active' AND follows.in_app_enabled
     AND follows.wechat_enabled AND follows.wechat_template_status='accepted' AND follows.authorization_id=inbox.authorization_id
     AND identities.linked_at<=follows.authorized_at)
   OR (inbox.authorization_source='direction' AND profiles.status='active' AND profiles.in_app_enabled
     AND profiles.wechat_enabled AND profiles.wechat_template_status='accepted' AND profiles.authorization_id=inbox.authorization_id
     AND identities.linked_at<=profiles.authorized_at
     AND COALESCE(jobs.title,'')=COALESCE(events.job_snapshot->>'title','')
     AND COALESCE(jobs.category,'')=COALESCE(events.job_snapshot->>'category','')
     AND users.member_status IN ('active','pro','lifetime') AND COALESCE(users.member_type,'') NOT IN ('none','trial_week')
     AND (users.member_cycle_start_at IS NULL OR users.member_cycle_start_at<=NOW())
     AND (users.member_expire_at IS NULL OR users.member_expire_at>NOW())));
