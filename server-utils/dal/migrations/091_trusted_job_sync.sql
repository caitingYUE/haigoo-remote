-- Candidate isolation: scanners never mutate jobs. Run once before enabling workers.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sync_revision BIGINT NOT NULL DEFAULT 0;
-- Existing published_at is mandatory and also drives on-site opportunity ordering.
-- Preserve the nullable source date separately; never manufacture a source date.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_manual_verified_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION bump_job_sync_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.sync_revision := OLD.sync_revision + 1; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS jobs_sync_revision ON jobs;
CREATE TRIGGER jobs_sync_revision BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION bump_job_sync_revision();

CREATE TABLE IF NOT EXISTS job_sync_sources (
  id TEXT PRIMARY KEY, source_key TEXT NOT NULL UNIQUE, url TEXT NOT NULL,
  adapter TEXT NOT NULL, config JSONB NOT NULL DEFAULT '{}', enabled BOOLEAN NOT NULL DEFAULT false,
  capabilities JSONB NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 1,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ, last_complete_at TIMESTAMPTZ, complete_count INTEGER,
  failure_count INTEGER NOT NULL DEFAULT 0, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS job_sync_source_companies (
  source_id TEXT NOT NULL REFERENCES job_sync_sources(id), company_id TEXT NOT NULL,
  rule JSONB NOT NULL DEFAULT '{}', PRIMARY KEY(source_id,company_id)
);
CREATE TABLE IF NOT EXISTS job_sync_runs (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES job_sync_sources(id), source_revision INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','complete','partial','blocked','failed','cancelled')),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), lease_token TEXT, lease_until TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0, cursor JSONB, evidence JSONB NOT NULL DEFAULT '{}',
  item_count INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), finished_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS job_sync_one_active_run ON job_sync_runs(source_id) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS job_sync_run_queue ON job_sync_runs(available_at) WHERE status IN ('queued','running');
CREATE TABLE IF NOT EXISTS job_sync_run_items (
  run_id TEXT NOT NULL REFERENCES job_sync_runs(id), external_id TEXT NOT NULL, payload JSONB NOT NULL,
  PRIMARY KEY(run_id,external_id)
);
CREATE TABLE IF NOT EXISTS job_sync_source_jobs (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES job_sync_sources(id), external_id TEXT NOT NULL,
  job_id TEXT, company_id TEXT, payload JSONB NOT NULL, content_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ,
  first_missing_at TIMESTAMPTZ, missing_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(source_id,external_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS job_sync_unique_bound_job ON job_sync_source_jobs(source_id,job_id) WHERE job_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS job_sync_source_versions (
  source_job_id TEXT NOT NULL REFERENCES job_sync_source_jobs(id),version INTEGER NOT NULL,
  payload JSONB NOT NULL,content_hash TEXT NOT NULL,run_id TEXT REFERENCES job_sync_runs(id),observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(source_job_id,version)
);
CREATE TABLE IF NOT EXISTS job_sync_candidates (
  id TEXT PRIMARY KEY, source_job_id TEXT REFERENCES job_sync_source_jobs(id), run_id TEXT REFERENCES job_sync_runs(id),
  company_id TEXT, job_id TEXT, create_job_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('create','update','close','reopen')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','superseded')),
  queue TEXT NOT NULL DEFAULT 'changes' CHECK(queue IN ('changes','baseline','eligibility','manual')),
  base_revision BIGINT, source_version INTEGER, version INTEGER NOT NULL DEFAULT 1,
  dedupe_key TEXT NOT NULL UNIQUE, before_payload JSONB NOT NULL DEFAULT '{}', patch JSONB NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}', eligibility JSONB NOT NULL DEFAULT '{}',
  deferred_until TIMESTAMPTZ, enrichment_status TEXT NOT NULL DEFAULT 'pending', enrichment_error TEXT,
  enrichment_started_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ, reviewer TEXT, reason TEXT
);
CREATE INDEX IF NOT EXISTS job_sync_pending ON job_sync_candidates(company_id,created_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS job_sync_audit (
  id BIGSERIAL PRIMARY KEY, candidate_id TEXT REFERENCES job_sync_candidates(id), actor TEXT NOT NULL, action TEXT NOT NULL,
  before_payload JSONB, after_payload JSONB, accepted_patch JSONB, reason TEXT, review_duration_ms INTEGER,edited_field_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS job_sync_outbox (
  id BIGSERIAL PRIMARY KEY, candidate_id TEXT NOT NULL UNIQUE REFERENCES job_sync_candidates(id), company_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_token TEXT, lease_until TIMESTAMPTZ, last_error TEXT
);

CREATE OR REPLACE FUNCTION claim_job_sync_run(p_token TEXT) RETURNS SETOF job_sync_runs LANGUAGE sql AS $$
  UPDATE job_sync_runs r SET status='running',lease_token=p_token,lease_until=NOW()+INTERVAL '4 minutes',attempts=r.attempts+1
  WHERE r.id=(SELECT q.id FROM job_sync_runs q JOIN job_sync_sources s ON s.id=q.source_id
    WHERE s.enabled AND q.source_revision=s.revision AND q.available_at<=NOW()
      AND (q.status='queued' OR (q.status='running' AND q.lease_until<NOW()))
    ORDER BY q.available_at,q.created_at FOR UPDATE OF q SKIP LOCKED LIMIT 1)
  RETURNING r.*
$$;

CREATE OR REPLACE FUNCTION save_job_sync_page(p_run TEXT,p_token TEXT,p_items JSONB,p_cursor JSONB) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r job_sync_runs; s job_sync_sources; item JSONB;
BEGIN
  SELECT * INTO r FROM job_sync_runs WHERE id=p_run FOR UPDATE;
  SELECT * INTO s FROM job_sync_sources WHERE id=r.source_id FOR SHARE;
  IF r.id IS NULL OR r.status<>'running' OR r.lease_token IS DISTINCT FROM p_token OR r.lease_until<=NOW()
    OR NOT s.enabled OR s.revision<>r.source_revision THEN RAISE EXCEPTION 'SCAN_CONFLICT'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF EXISTS(SELECT 1 FROM job_sync_run_items WHERE run_id=p_run AND external_id=item->>'external_id') THEN RAISE EXCEPTION 'PAGE_OVERLAP'; END IF;
    INSERT INTO job_sync_run_items(run_id,external_id,payload) VALUES(p_run,item->>'external_id',item)
    ON CONFLICT(run_id,external_id) DO UPDATE SET payload=EXCLUDED.payload;
  END LOOP;
  UPDATE job_sync_runs SET cursor=p_cursor,item_count=(SELECT COUNT(*) FROM job_sync_run_items WHERE run_id=p_run) WHERE id=p_run;
END $$;

-- Commits an observation batch and its proposals atomically, fenced by lease and source revision.
CREATE OR REPLACE FUNCTION finish_job_sync_run(p_run TEXT,p_token TEXT,p_observations JSONB,p_candidates JSONB,p_result JSONB)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r job_sync_runs; s job_sync_sources; o JSONB; c JSONB; current_version INTEGER;
BEGIN
  SELECT * INTO r FROM job_sync_runs WHERE id=p_run FOR UPDATE;
  SELECT * INTO s FROM job_sync_sources WHERE id=r.source_id FOR UPDATE;
  IF r.id IS NULL OR r.status<>'running' OR r.lease_token IS DISTINCT FROM p_token OR r.lease_until<=NOW()
    OR NOT s.enabled OR s.revision<>r.source_revision THEN RAISE EXCEPTION 'SCAN_CONFLICT'; END IF;
  FOR o IN SELECT value FROM jsonb_array_elements(p_observations) LOOP
    SELECT version INTO current_version FROM job_sync_source_jobs WHERE id=o->>'id' FOR UPDATE;
    IF current_version IS DISTINCT FROM (o->>'expected_version')::integer THEN RAISE EXCEPTION 'OBSERVATION_CONFLICT'; END IF;
    INSERT INTO job_sync_source_jobs(id,source_id,external_id,job_id,company_id,payload,content_hash,version,state,last_seen_at,first_missing_at,missing_count)
    VALUES(o->>'id',r.source_id,o->>'external_id',o->>'job_id',o->>'company_id',o->'payload',o->>'content_hash',
      (o->>'version')::integer,o->>'state',(o->>'last_seen_at')::timestamptz,(o->>'first_missing_at')::timestamptz,(o->>'missing_count')::integer)
    ON CONFLICT(id) DO UPDATE SET job_id=EXCLUDED.job_id,company_id=EXCLUDED.company_id,payload=EXCLUDED.payload,
      content_hash=EXCLUDED.content_hash,version=EXCLUDED.version,state=EXCLUDED.state,last_seen_at=EXCLUDED.last_seen_at,
      first_missing_at=EXCLUDED.first_missing_at,missing_count=EXCLUDED.missing_count;
    UPDATE job_sync_candidates SET status='superseded',version=version+1
      WHERE source_job_id=o->>'id' AND status='pending' AND source_version<>(o->>'version')::integer;
    INSERT INTO job_sync_source_versions(source_job_id,version,payload,content_hash,run_id)
      VALUES(o->>'id',(o->>'version')::integer,o->'payload',o->>'content_hash',p_run) ON CONFLICT DO NOTHING;
  END LOOP;
  FOR c IN SELECT value FROM jsonb_array_elements(p_candidates) LOOP
    INSERT INTO job_sync_candidates(id,source_job_id,run_id,company_id,job_id,create_job_id,kind,queue,base_revision,source_version,dedupe_key,before_payload,patch,evidence,eligibility)
    VALUES(c->>'id',c->>'source_job_id',p_run,c->>'company_id',c->>'job_id',c->>'create_job_id',c->>'kind',c->>'queue',
      (c->>'base_revision')::bigint,(c->>'source_version')::integer,c->>'dedupe_key',c->'before_payload',c->'patch',c->'evidence',c->'eligibility')
    ON CONFLICT(dedupe_key) DO UPDATE SET evidence=EXCLUDED.evidence
      WHERE job_sync_candidates.status='pending' AND job_sync_candidates.source_version=EXCLUDED.source_version;
  END LOOP;
  UPDATE job_sync_runs SET status=p_result->>'status',evidence=p_result,error=p_result->>'error',finished_at=NOW(),lease_token=NULL,lease_until=NULL WHERE id=p_run;
  UPDATE job_sync_sources SET last_attempt_at=NOW(),
    last_success_at=CASE WHEN p_result->>'status' IN ('complete','partial') THEN NOW() ELSE last_success_at END,
    last_complete_at=CASE WHEN (p_result->>'trusted_complete')::boolean THEN NOW() ELSE last_complete_at END,
    complete_count=CASE WHEN (p_result->>'trusted_complete')::boolean THEN r.item_count ELSE complete_count END,
    failure_count=CASE WHEN p_result->>'status'='complete' THEN 0 ELSE failure_count+1 END,
    next_run_at=NOW()+CASE WHEN p_result->>'status'='complete' THEN INTERVAL '24 hours'
      ELSE LEAST(INTERVAL '24 hours',INTERVAL '1 hour'*power(2,LEAST(failure_count,5))) END,
    last_error=p_result->>'error' WHERE id=r.source_id;
END $$;

CREATE OR REPLACE FUNCTION review_job_sync_candidate(p_id TEXT,p_version INTEGER,p_actor TEXT,p_action TEXT,p_patch JSONB,p_company TEXT,p_reason TEXT,p_review_ms INTEGER DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE c job_sync_candidates; sj job_sync_source_jobs; old_job jobs; new_job jobs; co trusted_companies; target TEXT; k TEXT;
  allowed TEXT[]:=ARRAY['title','description','url','location','salary','job_type','experience_level','category','tags','requirements','benefits','is_remote','region','timezone','china_friendly','published_at','translations'];
BEGIN
  SELECT * INTO c FROM job_sync_candidates WHERE id=p_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'CANDIDATE_NOT_FOUND'; END IF;
  IF c.status='approved' AND p_action='approve' THEN RETURN jsonb_build_object('id',c.id,'status',c.status,'jobId',COALESCE(c.job_id,c.create_job_id)); END IF;
  IF c.status<>'pending' OR c.version<>p_version THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
  IF NULLIF(BTRIM(p_actor),'') IS NULL THEN RAISE EXCEPTION 'ACTOR_REQUIRED'; END IF;
  IF p_action='defer' THEN
    UPDATE job_sync_candidates SET deferred_until=NOW()+INTERVAL '24 hours',version=version+1 WHERE id=p_id;
    INSERT INTO job_sync_audit(candidate_id,actor,action,reason) VALUES(p_id,p_actor,p_action,p_reason);
    RETURN jsonb_build_object('id',p_id,'status','pending');
  END IF;
  IF p_action='reject' THEN
    UPDATE job_sync_candidates SET status='rejected',reviewed_at=NOW(),reviewer=p_actor,reason=p_reason,version=version+1 WHERE id=p_id;
    INSERT INTO job_sync_audit(candidate_id,actor,action,reason) VALUES(p_id,p_actor,p_action,p_reason);
    RETURN jsonb_build_object('id',p_id,'status','rejected');
  END IF;
  IF p_action<>'approve' OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_REVIEW'; END IF;
  IF c.source_job_id IS NOT NULL THEN
    SELECT * INTO sj FROM job_sync_source_jobs WHERE id=c.source_job_id FOR UPDATE;
    IF sj.version<>c.source_version OR sj.job_id IS DISTINCT FROM c.job_id THEN RAISE EXCEPTION 'SOURCE_CONFLICT'; END IF;
    IF NOT EXISTS(SELECT 1 FROM job_sync_sources WHERE id=sj.source_id AND revision=(c.evidence->>'source_revision')::integer) THEN RAISE EXCEPTION 'SOURCE_CONFLICT'; END IF;
    IF c.kind='close' AND (sj.state<>'closed' OR c.evidence->>'checked_at' IS NULL OR (c.evidence->>'checked_at')::timestamptz<NOW()-INTERVAL '48 hours') THEN RAISE EXCEPTION 'EVIDENCE_STALE'; END IF;
  END IF;
  SELECT * INTO co FROM trusted_companies WHERE company_id=COALESCE(c.company_id,p_company) AND status='active' FOR UPDATE;
  IF co.company_id IS NULL THEN RAISE EXCEPTION 'COMPANY_REQUIRED'; END IF;
  IF sj.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM job_sync_source_companies WHERE source_id=sj.source_id AND company_id=co.company_id) THEN RAISE EXCEPTION 'COMPANY_MISMATCH'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT k=ANY(allowed) THEN RAISE EXCEPTION 'FIELD_NOT_ALLOWED: %',k; END IF;
  END LOOP;
  IF c.kind='close' AND p_patch<>'{}'::jsonb THEN RAISE EXCEPTION 'CLOSE_PATCH_NOT_ALLOWED'; END IF;
  target:=COALESCE(c.job_id,c.create_job_id);
  IF c.job_id IS NOT NULL THEN
    SELECT * INTO old_job FROM jobs WHERE job_id=c.job_id FOR UPDATE;
    IF old_job.job_id IS NULL OR old_job.sync_revision IS DISTINCT FROM c.base_revision OR old_job.company_id IS DISTINCT FROM co.company_id THEN RAISE EXCEPTION 'JOB_CONFLICT'; END IF;
    new_job:=jsonb_populate_record(old_job,p_patch);
  ELSE
    IF c.kind<>'create' THEN RAISE EXCEPTION 'JOB_REQUIRED'; END IF;
    new_job:=jsonb_populate_record(NULL::jobs,p_patch);
  END IF;
  IF c.kind<>'close' AND (NULLIF(BTRIM(new_job.title),'') IS NULL OR length(COALESCE(new_job.description,''))<50
    OR (COALESCE(new_job.url,'') !~ '^https?://' AND NULLIF(BTRIM(co.hiring_email),'') IS NULL)) THEN RAISE EXCEPTION 'INCOMPLETE_JOB'; END IF;
  IF c.job_id IS NULL THEN
    INSERT INTO jobs(job_id,title,description,url,company_id,company,company_website,company_logo,location,salary,job_type,experience_level,
      category,tags,requirements,benefits,is_remote,region,timezone,china_friendly,published_at,source_published_at,translations,is_translated,status,is_approved,
      source,source_type,is_trusted,member_only,can_refer,is_manually_edited,last_manual_verified_at,created_at,updated_at)
    VALUES(target,new_job.title,new_job.description,new_job.url,co.company_id,co.name,co.website,co.logo,new_job.location,new_job.salary,
      new_job.job_type,new_job.experience_level,new_job.category,COALESCE(new_job.tags,'[]'),COALESCE(new_job.requirements,'[]'),COALESCE(new_job.benefits,'[]'),
      new_job.is_remote,new_job.region,new_job.timezone,new_job.china_friendly,COALESCE(new_job.published_at,NOW()),new_job.published_at,new_job.translations,new_job.translations IS NOT NULL,
      'active',true,'company-sync','official',true,COALESCE(co.member_only,false),COALESCE(co.can_refer,false),true,NOW(),NOW(),NOW());
  ELSE
    UPDATE jobs SET title=new_job.title,description=new_job.description,url=new_job.url,location=new_job.location,salary=new_job.salary,
      job_type=new_job.job_type,experience_level=new_job.experience_level,category=new_job.category,tags=new_job.tags,requirements=new_job.requirements,
      benefits=new_job.benefits,is_remote=new_job.is_remote,region=new_job.region,timezone=new_job.timezone,china_friendly=new_job.china_friendly,
      published_at=COALESCE(new_job.published_at,published_at),source_published_at=CASE WHEN p_patch ? 'published_at' THEN new_job.published_at ELSE source_published_at END,translations=new_job.translations,
      is_translated=CASE WHEN p_patch ? 'translations' THEN new_job.translations IS NOT NULL ELSE is_translated END,
      status=CASE WHEN c.kind='close' THEN 'inactive' WHEN c.kind='reopen' THEN 'active' ELSE status END,
      is_approved=CASE WHEN c.kind='reopen' THEN true ELSE is_approved END,updated_at=NOW(),last_manual_verified_at=NOW(),is_manually_edited=true WHERE job_id=target;
  END IF;
  UPDATE job_sync_source_jobs SET job_id=target,company_id=co.company_id,version=version+1 WHERE id=c.source_job_id;
  UPDATE job_sync_candidates SET status='approved',company_id=co.company_id,job_id=target,reviewer=p_actor,reviewed_at=NOW(),reason=p_reason,version=version+1 WHERE id=p_id;
  INSERT INTO job_sync_audit(candidate_id,actor,action,before_payload,after_payload,accepted_patch,reason,review_duration_ms,edited_field_count)
    SELECT p_id,p_actor,p_action,CASE WHEN old_job.job_id IS NULL THEN NULL ELSE to_jsonb(old_job) END,to_jsonb(j),p_patch,p_reason,
      CASE WHEN p_review_ms IS NULL THEN NULL ELSE GREATEST(0,LEAST(p_review_ms,86400000)) END,
      (SELECT COUNT(*) FROM jsonb_each(p_patch) kv WHERE kv.value IS DISTINCT FROM c.patch->kv.key) FROM jobs j WHERE job_id=target;
  UPDATE trusted_companies SET job_count=(SELECT COUNT(*) FROM jobs WHERE company_id=co.company_id AND status='active' AND is_approved IS TRUE),updated_at=NOW() WHERE company_id=co.company_id;
  INSERT INTO job_sync_outbox(candidate_id,company_id) VALUES(p_id,co.company_id) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('id',p_id,'status','approved','jobId',target);
END $$;

CREATE OR REPLACE FUNCTION configure_job_sync_source(p_id TEXT,p_revision INTEGER,p_url TEXT,p_adapter TEXT,p_config JSONB,p_enabled BOOLEAN,p_capabilities JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s job_sync_sources; changed BOOLEAN;
BEGIN
  SELECT * INTO s FROM job_sync_sources WHERE id=p_id FOR UPDATE;
  IF s.id IS NULL OR s.revision<>p_revision THEN RAISE EXCEPTION 'SOURCE_CONFLICT'; END IF;
  changed:=s.url IS DISTINCT FROM p_url OR s.adapter IS DISTINCT FROM p_adapter OR s.config IS DISTINCT FROM p_config OR s.capabilities IS DISTINCT FROM p_capabilities;
  UPDATE job_sync_sources SET url=p_url,adapter=p_adapter,config=p_config,enabled=p_enabled,capabilities=p_capabilities,revision=revision+CASE WHEN changed THEN 1 ELSE 0 END,
    complete_count=CASE WHEN changed THEN NULL ELSE complete_count END,last_complete_at=CASE WHEN changed THEN NULL ELSE last_complete_at END,
    next_run_at=NOW() WHERE id=p_id;
  UPDATE job_sync_runs SET status='cancelled',lease_token=NULL,lease_until=NULL,finished_at=NOW(),error='来源配置已修改' WHERE source_id=p_id AND status IN ('queued','running');
  IF changed THEN
    UPDATE job_sync_candidates SET status='superseded',version=version+1 WHERE status='pending' AND source_job_id IN(SELECT id FROM job_sync_source_jobs WHERE source_id=p_id);
    UPDATE job_sync_source_jobs SET first_missing_at=NULL,missing_count=0,version=version+1,payload=payload||'{"_unverified":true}'::jsonb WHERE source_id=p_id;
    IF s.url IS DISTINCT FROM p_url OR s.adapter IS DISTINCT FROM p_adapter OR s.config->>'board' IS DISTINCT FROM p_config->>'board' OR s.config->>'site' IS DISTINCT FROM p_config->>'site' THEN
      UPDATE job_sync_sources SET capabilities=capabilities||'{"absence":false}'::jsonb,last_error='来源已迁移；请核对历史绑定后重新启用缺失检测' WHERE id=p_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('id',p_id,'revision',s.revision+CASE WHEN changed THEN 1 ELSE 0 END);
END $$;

CREATE OR REPLACE FUNCTION bind_job_sync_job(p_source_job TEXT,p_job TEXT,p_version INTEGER,p_actor TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s job_sync_source_jobs; j jobs;
BEGIN
  SELECT * INTO s FROM job_sync_source_jobs WHERE id=p_source_job FOR UPDATE;
  SELECT * INTO j FROM jobs WHERE job_id=p_job FOR SHARE;
  IF s.id IS NULL OR s.version<>p_version OR s.job_id IS NOT NULL THEN RAISE EXCEPTION 'SOURCE_CONFLICT'; END IF;
  IF j.job_id IS NULL OR NOT EXISTS(SELECT 1 FROM job_sync_source_companies WHERE source_id=s.source_id AND company_id=j.company_id) THEN RAISE EXCEPTION 'COMPANY_MISMATCH'; END IF;
  UPDATE job_sync_candidates SET status='superseded',version=version+1 WHERE status='pending' AND source_job_id IN(SELECT id FROM job_sync_source_jobs WHERE source_id=s.source_id AND job_id=p_job);
  UPDATE job_sync_source_jobs SET job_id=NULL,version=version+1 WHERE source_id=s.source_id AND job_id=p_job;
  UPDATE job_sync_source_jobs SET job_id=p_job,company_id=j.company_id,version=version+1 WHERE id=p_source_job;
  UPDATE job_sync_candidates SET status='superseded',version=version+1 WHERE source_job_id=p_source_job AND status='pending';
  INSERT INTO job_sync_audit(actor,action,after_payload) VALUES(p_actor,'bind',jsonb_build_object('sourceJobId',p_source_job,'jobId',p_job));
END $$;
