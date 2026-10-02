-- Manual preflight is mandatory. Existing queued work is deliberately not grandfathered.
ALTER TABLE job_sync_runs ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE job_sync_runs ADD COLUMN IF NOT EXISTS requested_by TEXT;
ALTER TABLE job_sync_runs ADD COLUMN IF NOT EXISTS scope_company_id TEXT;
ALTER TABLE job_sync_runs ADD COLUMN IF NOT EXISTS confirmed_by TEXT;
ALTER TABLE job_sync_runs ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE job_sync_runs ADD COLUMN IF NOT EXISTS preflight_at TIMESTAMPTZ;
UPDATE job_sync_runs SET status='cancelled',finished_at=NOW(),lease_token=NULL,lease_until=NULL,error='需重新进行人工预检' WHERE mode='legacy' AND status IN ('queued','running');
UPDATE job_sync_candidates SET status='superseded',version=version+1 WHERE status='pending' AND run_id IN(SELECT id FROM job_sync_runs WHERE mode='legacy');
CREATE TABLE IF NOT EXISTS job_sync_url_checks (
  job_id TEXT PRIMARY KEY, job_revision BIGINT NOT NULL, url TEXT NOT NULL,
  state TEXT NOT NULL, reason TEXT NOT NULL, checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION claim_job_sync_run(p_token TEXT) RETURNS SETOF job_sync_runs LANGUAGE sql AS $$
  UPDATE job_sync_runs r SET status='running',lease_token=p_token,lease_until=NOW()+INTERVAL '4 minutes',attempts=r.attempts+1
  WHERE r.id=(SELECT q.id FROM job_sync_runs q JOIN job_sync_sources s ON s.id=q.source_id
    WHERE s.enabled AND q.source_revision=s.revision AND q.available_at<=NOW() AND NULLIF(q.requested_by,'') IS NOT NULL
      AND (q.mode='preflight' OR (q.mode='capture' AND q.confirmed_by IS NOT NULL AND q.preflight_at>NOW()-INTERVAL '1 hour'))
      AND (q.status='queued' OR (q.status='running' AND q.lease_until<NOW()))
    ORDER BY q.available_at,q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1)
  RETURNING r.*
$$;

CREATE OR REPLACE FUNCTION confirm_job_sync_preflight(p_id TEXT,p_actor TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE r job_sync_runs; s job_sync_sources;
BEGIN
  SELECT * INTO r FROM job_sync_runs WHERE id=p_id FOR UPDATE;
  SELECT * INTO s FROM job_sync_sources WHERE id=r.source_id FOR SHARE;
  IF r.mode='capture' AND r.confirmed_by IS NOT NULL THEN RETURN r.id; END IF;
  IF r.id IS NULL OR r.mode<>'preflight' OR r.status<>'complete' OR r.evidence->>'preflight_passed' IS DISTINCT FROM 'true'
    OR r.preflight_at IS NULL OR r.created_at<NOW()-INTERVAL '1 hour' OR r.preflight_at<NOW()-INTERVAL '1 hour' OR NOT s.enabled OR s.revision<>r.source_revision
    OR NULLIF(p_actor,'') IS NULL THEN RAISE EXCEPTION 'PREFLIGHT_CONFLICT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM job_sync_source_companies WHERE source_id=r.source_id AND company_id=r.scope_company_id) THEN RAISE EXCEPTION 'COMPANY_MISMATCH'; END IF;
  UPDATE job_sync_runs SET mode='capture',status='queued',confirmed_by=p_actor,confirmed_at=NOW(),available_at=NOW(),finished_at=NULL WHERE id=p_id;
  INSERT INTO job_sync_audit(actor,action,after_payload) VALUES(p_actor,'confirm_preflight',jsonb_build_object('taskId',p_id,'sourceRevision',r.source_revision,'companyId',r.scope_company_id,'evidence',r.evidence));
  RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION record_job_sync_url_check(p_id TEXT,p_revision BIGINT,p_url TEXT,p_state TEXT,p_reason TEXT,p_candidate TEXT,p_dedupe TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE j jobs;
BEGIN
  SELECT * INTO j FROM jobs WHERE job_id=p_id FOR SHARE;
  IF j.job_id IS NULL OR j.sync_revision<>p_revision OR j.url IS DISTINCT FROM p_url OR j.status<>'active' THEN RETURN false; END IF;
  INSERT INTO job_sync_url_checks(job_id,job_revision,url,state,reason) VALUES(p_id,p_revision,p_url,p_state,p_reason)
    ON CONFLICT(job_id) DO UPDATE SET job_revision=EXCLUDED.job_revision,url=EXCLUDED.url,state=EXCLUDED.state,reason=EXCLUDED.reason,checked_at=NOW();
  UPDATE job_sync_candidates SET status='superseded',version=version+1 WHERE job_id=p_id AND status='pending' AND evidence->>'method'='url-check' AND (base_revision<>p_revision OR p_state<>'closed');
  IF p_state='closed' THEN
    INSERT INTO job_sync_candidates(id,company_id,job_id,create_job_id,kind,base_revision,dedupe_key,before_payload,patch,evidence,eligibility)
    VALUES(p_candidate,j.company_id,j.job_id,'unused','close',j.sync_revision,p_dedupe,to_jsonb(j),'{}',
      jsonb_build_object('method','url-check','checked_url',p_url,'source_url',p_url,'checked_at',NOW(),'reason',p_reason),'{}')
    ON CONFLICT(dedupe_key) DO UPDATE SET evidence=EXCLUDED.evidence,status='pending',version=job_sync_candidates.version+CASE WHEN job_sync_candidates.status='superseded' THEN 1 ELSE 0 END WHERE job_sync_candidates.status IN ('pending','superseded');
  END IF;
  RETURN true;
END $$;

-- Fence even a direct invocation of the previous persistence function: partial/preflight data cannot become candidates.
CREATE OR REPLACE FUNCTION guard_job_sync_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r job_sync_runs;
BEGIN
  IF NEW.run_id IS NOT NULL THEN
    SELECT * INTO r FROM job_sync_runs WHERE id=NEW.run_id;
    IF r.mode<>'capture' OR r.confirmed_by IS NULL OR r.preflight_at<NOW()-INTERVAL '1 hour' THEN RAISE EXCEPTION 'PREFLIGHT_REQUIRED'; END IF;
    IF NEW.company_id IS NOT NULL AND NEW.company_id IS DISTINCT FROM r.scope_company_id THEN RAISE EXCEPTION 'COMPANY_MISMATCH'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER job_sync_candidate_gate BEFORE INSERT ON job_sync_candidates FOR EACH ROW EXECUTE FUNCTION guard_job_sync_candidate();

ALTER FUNCTION finish_job_sync_run(TEXT,TEXT,JSONB,JSONB,JSONB) RENAME TO persist_job_sync_run_v1;
CREATE FUNCTION finish_job_sync_run(p_run TEXT,p_token TEXT,p_observations JSONB,p_candidates JSONB,p_result JSONB)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r job_sync_runs;
BEGIN
  SELECT * INTO r FROM job_sync_runs WHERE id=p_run FOR UPDATE;
  IF p_observations<>'[]'::jsonb OR p_candidates<>'[]'::jsonb THEN
    IF r.mode IS DISTINCT FROM 'capture' OR r.confirmed_by IS NULL OR r.preflight_at<NOW()-INTERVAL '1 hour'
      OR p_result->>'trusted_complete' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'PREFLIGHT_REQUIRED'; END IF;
  END IF;
  PERFORM persist_job_sync_run_v1(p_run,p_token,p_observations,p_candidates,p_result);
END $$;

ALTER FUNCTION review_job_sync_candidate(TEXT,INTEGER,TEXT,TEXT,JSONB,TEXT,TEXT,INTEGER) RENAME TO publish_job_sync_review_v1;
CREATE FUNCTION review_job_sync_candidate(p_id TEXT,p_version INTEGER,p_actor TEXT,p_action TEXT,p_patch JSONB,p_company TEXT,p_reason TEXT,p_review_ms INTEGER DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE c job_sync_candidates; r job_sync_runs; j jobs; check_row job_sync_url_checks;
BEGIN
  SELECT * INTO c FROM job_sync_candidates WHERE id=p_id FOR UPDATE;
  IF p_action='approve' AND c.status<>'approved' THEN
    IF p_patch ?| ARRAY['category','tags','experience_level','region','china_friendly'] THEN RAISE EXCEPTION 'MANUAL_FIELD_PROTECTED'; END IF;
    IF c.kind='update' AND p_patch='{}'::jsonb THEN RAISE EXCEPTION 'ACCEPT_FIELDS_REQUIRED'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(p_patch) kv WHERE kv.value='null'::jsonb OR kv.value='""'::jsonb OR kv.value='[]'::jsonb) THEN RAISE EXCEPTION 'EMPTY_OVERWRITE_FORBIDDEN'; END IF;
    IF c.run_id IS NOT NULL THEN
      SELECT * INTO r FROM job_sync_runs WHERE id=c.run_id;
      IF r.mode<>'capture' OR r.confirmed_by IS NULL THEN RAISE EXCEPTION 'PREFLIGHT_REQUIRED'; END IF;
      IF COALESCE(c.company_id,p_company) IS DISTINCT FROM r.scope_company_id THEN RAISE EXCEPTION 'COMPANY_MISMATCH'; END IF;
    END IF;
    IF c.evidence->>'method'='url-check' THEN
      SELECT * INTO j FROM jobs WHERE job_id=c.job_id FOR UPDATE;
      SELECT * INTO check_row FROM job_sync_url_checks WHERE job_id=c.job_id FOR SHARE;
      IF j.sync_revision IS DISTINCT FROM c.base_revision OR j.url IS DISTINCT FROM c.evidence->>'checked_url'
        OR check_row.state IS DISTINCT FROM 'closed' OR check_row.url IS DISTINCT FROM j.url
        OR check_row.checked_at<NOW()-INTERVAL '24 hours' OR check_row.job_revision IS DISTINCT FROM j.sync_revision THEN RAISE EXCEPTION 'EVIDENCE_STALE'; END IF;
    END IF;
  END IF;
  RETURN publish_job_sync_review_v1(p_id,p_version,p_actor,p_action,p_patch,p_company,p_reason,p_review_ms);
END $$;
