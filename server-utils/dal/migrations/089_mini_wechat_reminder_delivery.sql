-- Deploy before the new worker. No backfill or sends of pre-deployment jobs/events.
ALTER TABLE mini_company_follows
  ADD COLUMN IF NOT EXISTS authorization_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE mini_company_follows SET authorized_at=updated_at, subscribed_at=created_at WHERE authorized_at IS NULL;
ALTER TABLE career_watch_profiles
  ADD COLUMN IF NOT EXISTS authorization_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE career_watch_profiles SET authorized_at=updated_at, subscribed_at=created_at WHERE authorized_at IS NULL;

CREATE OR REPLACE FUNCTION mini_reminder_authorization_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- An idempotent follow/profile save must not cancel already queued delivery.
  -- Explicit subscription endpoints rotate authorization_id even when TRUE stays TRUE.
  IF TG_OP='UPDATE' AND NEW.authorization_id IS NOT DISTINCT FROM OLD.authorization_id
    AND NEW.wechat_enabled IS NOT DISTINCT FROM OLD.wechat_enabled
    AND NEW.wechat_template_status IS NOT DISTINCT FROM OLD.wechat_template_status
    AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  NEW.authorization_id := gen_random_uuid();
  NEW.authorized_at := clock_timestamp();
  IF TG_OP='INSERT' THEN NEW.subscribed_at := clock_timestamp();
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN NEW.subscribed_at := clock_timestamp();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mini_follow_authorization_version ON mini_company_follows;
CREATE TRIGGER mini_follow_authorization_version BEFORE INSERT OR UPDATE OF wechat_enabled, wechat_template_status, status
  ON mini_company_follows FOR EACH ROW EXECUTE FUNCTION mini_reminder_authorization_version();
DROP TRIGGER IF EXISTS mini_direction_authorization_version ON career_watch_profiles;
CREATE TRIGGER mini_direction_authorization_version BEFORE INSERT OR UPDATE OF wechat_enabled, wechat_template_status, status
  ON career_watch_profiles FOR EACH ROW EXECUTE FUNCTION mini_reminder_authorization_version();

ALTER TABLE mini_company_update_events
  ADD COLUMN IF NOT EXISTS job_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;
-- Preserve history without turning previously unprocessed old events into a broadcast.
UPDATE mini_company_update_events SET prepared_at=NOW() WHERE prepared_at IS NULL AND job_snapshot='{}'::jsonb;
ALTER TABLE mini_company_update_inbox DROP CONSTRAINT IF EXISTS mini_company_update_inbox_notification_status_check;
ALTER TABLE mini_company_update_inbox ADD CONSTRAINT mini_company_update_inbox_notification_status_check
  CHECK (notification_status IN ('pending','processing','not_requested','sent','failed','unknown'));
ALTER TABLE mini_company_update_inbox
  ADD COLUMN IF NOT EXISTS authorization_id UUID,
  ADD COLUMN IF NOT EXISTS authorization_source TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_id UUID,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS wechat_message_id TEXT;
UPDATE mini_company_update_inbox SET notification_status='not_requested', last_error='legacy_unverified_authorization'
  WHERE notification_status='pending' AND authorization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_mini_reminder_pending ON mini_company_update_inbox(next_attempt_at,created_at)
  WHERE notification_status='pending';
CREATE INDEX IF NOT EXISTS idx_mini_reminder_unprepared ON mini_company_update_events(occurred_at) WHERE prepared_at IS NULL;
CREATE TABLE IF NOT EXISTS mini_reminder_worker_lease (
  name TEXT PRIMARY KEY, token UUID NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION mini_job_is_public(j JSONB, c JSONB) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE(j->>'status'='active' AND (j->>'is_approved')::boolean
   AND NOT COALESCE((j->>'member_only')::boolean,FALSE) AND c->>'status'='active'
   AND (BTRIM(COALESCE(j->>'url','')) ~* '^https?://[^[:space:]]+$'
     OR BTRIM(COALESCE(c->>'hiring_email','')) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),FALSE)
$$;
CREATE OR REPLACE FUNCTION mini_enqueue_job_opportunity(j JSONB, c JSONB, reopened boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF j->>'source_type'='mini_catalog_projection' OR NOT mini_job_is_public(j,c) THEN RETURN; END IF;
  INSERT INTO mini_company_update_events(company_id,event_type,event_hash,source_job_id,has_public_opportunity,job_snapshot,occurred_at)
    VALUES(c->>'company_id',CASE WHEN reopened THEN 'job_reopened' ELSE 'job_added' END,
      replace(gen_random_uuid()::text,'-',''),j->>'job_id',TRUE,
      jsonb_build_object('title',j->>'title','description',j->>'description','category',j->>'category'),clock_timestamp());
END $$;
CREATE OR REPLACE FUNCTION mini_capture_job_opportunity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c JSONB; old_c JSONB; reopened boolean := FALSE;
BEGIN
  IF NEW.source_type='mini_catalog_projection' THEN RETURN NEW; END IF;
  SELECT to_jsonb(tc) INTO c FROM trusted_companies tc
    WHERE tc.company_id=NEW.company_id OR (NEW.company_id IS NULL AND lower(btrim(tc.name))=lower(btrim(NEW.company)))
    ORDER BY tc.company_id LIMIT 1;
  IF NOT mini_job_is_public(to_jsonb(NEW),c) THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    reopened := OLD.is_approved IS TRUE AND OLD.status='inactive';
    SELECT to_jsonb(tc) INTO old_c FROM trusted_companies tc
      WHERE tc.company_id=OLD.company_id OR (OLD.company_id IS NULL AND lower(btrim(tc.name))=lower(btrim(OLD.company)))
      ORDER BY tc.company_id LIMIT 1;
    IF mini_job_is_public(to_jsonb(OLD),old_c) AND old_c->>'company_id'=c->>'company_id' THEN RETURN NEW; END IF;
  END IF;
  PERFORM mini_enqueue_job_opportunity(to_jsonb(NEW),c,reopened);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mini_capture_job_opportunity ON jobs;
CREATE TRIGGER mini_capture_job_opportunity AFTER INSERT OR UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION mini_capture_job_opportunity();
CREATE OR REPLACE FUNCTION mini_capture_company_opportunities() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j JSONB;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.hiring_email IS NOT DISTINCT FROM OLD.hiring_email THEN RETURN NEW; END IF;
  FOR j IN SELECT to_jsonb(jobs) FROM jobs WHERE company_id=NEW.company_id
    OR (company_id IS NULL AND lower(btrim(company))=lower(btrim(NEW.name))) LOOP
    IF NOT mini_job_is_public(j,to_jsonb(OLD)) THEN
      PERFORM mini_enqueue_job_opportunity(j,to_jsonb(NEW),TRUE);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mini_capture_company_opportunities ON trusted_companies;
CREATE TRIGGER mini_capture_company_opportunities AFTER UPDATE OF status,hiring_email ON trusted_companies
  FOR EACH ROW EXECUTE FUNCTION mini_capture_company_opportunities();

-- Only one authorization source per recipient/event. Revalidate immediately before each attempt.
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
     AND (users.member_expire_at IS NULL OR users.member_expire_at>NOW())
     AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(events.role_families) r(value) WHERE profiles.role_families ? r.value)
     AND (profiles.source_mode<>'manual' OR jsonb_array_length(COALESCE(profiles.custom_role_terms,'[]'::jsonb))=0
       OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(profiles.custom_role_terms) t(value)
         WHERE concat_ws(' ',jobs.title,jobs.category) ILIKE '%'||t.value||'%'))));

CREATE OR REPLACE FUNCTION mini_claim_reminder(p_worker UUID,p_app TEXT) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE item RECORD; aid UUID := gen_random_uuid();
BEGIN
  PERFORM 1 FROM mini_reminder_worker_lease WHERE name='wechat' AND token=p_worker AND expires_at>NOW()+INTERVAL '15 seconds' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT d.* INTO item FROM mini_reminder_deliverable d JOIN mini_company_update_inbox i ON i.inbox_id=d.inbox_id
    WHERE d.app_id=p_app AND i.notification_status='pending' AND i.next_attempt_at<=NOW()
    ORDER BY i.created_at,i.inbox_id LIMIT 1 FOR UPDATE OF i SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE mini_company_update_inbox SET notification_status='processing',started_at=clock_timestamp(),attempt_id=aid,
    attempt_count=attempt_count+1 WHERE inbox_id=item.inbox_id;
  RETURN to_jsonb(item)||jsonb_build_object('attempt_id',aid,'attempt_count',item.attempt_count+1);
END $$;

CREATE OR REPLACE FUNCTION mini_finish_reminder(p_attempt UUID,p_status TEXT,p_error TEXT,p_message TEXT DEFAULT NULL)
 RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE item RECORD;
BEGIN
  IF p_status NOT IN ('sent','pending','failed','unknown') THEN RAISE EXCEPTION 'Invalid reminder result'; END IF;
  SELECT i.*,e.company_id INTO item FROM mini_company_update_inbox i JOIN mini_company_update_events e ON e.event_id=i.event_id
    WHERE i.attempt_id=p_attempt AND i.notification_status='processing' FOR UPDATE OF i;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE mini_company_update_inbox SET notification_status=CASE WHEN p_status='pending' AND attempt_count>=5 THEN 'failed' ELSE p_status END,
    last_error=p_error,wechat_message_id=p_message,notified_at=CASE WHEN p_status='sent' THEN NOW() ELSE notified_at END,
    next_attempt_at=NOW()+make_interval(secs=>LEAST(3600,60*power(2,attempt_count-1)::int))
    WHERE inbox_id=item.inbox_id;
  IF p_status IN ('sent','unknown') OR p_error='43101' THEN
    UPDATE mini_company_follows SET wechat_enabled=FALSE,wechat_template_status=CASE WHEN p_error='43101' THEN 'rejected' ELSE 'not_requested' END,updated_at=NOW()
      WHERE user_id=item.user_id AND wechat_enabled AND ((p_error='43101' AND authorized_at<item.started_at)
        OR (item.authorization_source='follow' AND company_id=item.company_id AND authorization_id=item.authorization_id));
    UPDATE career_watch_profiles SET wechat_enabled=FALSE,wechat_template_status=CASE WHEN p_error='43101' THEN 'rejected' ELSE 'not_requested' END,updated_at=NOW()
      WHERE user_id=item.user_id AND wechat_enabled AND ((p_error='43101' AND authorized_at<item.started_at)
        OR (item.authorization_source='direction' AND authorization_id=item.authorization_id));
  END IF;
  RETURN TRUE;
END $$;
