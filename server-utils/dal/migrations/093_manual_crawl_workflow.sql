-- Manual-only workflow: no enabled flag, scheduler or automatic job mutation.
CREATE TABLE IF NOT EXISTS job_crawl_qualifications (
 company_id TEXT PRIMARY KEY, url TEXT NOT NULL, source_version TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('approved','rejected')), reason TEXT,
 actor TEXT NOT NULL, reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS job_crawl_sessions (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, actor TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('preflight','update')),
 status TEXT NOT NULL DEFAULT 'running', company_ids TEXT[] NOT NULL,
 companies JSONB NOT NULL DEFAULT '[]', revision INTEGER NOT NULL DEFAULT 1,
 lease_token TEXT, lease_until TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(actor,request_id)
);
CREATE TABLE IF NOT EXISTS job_crawl_items (
 id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES job_crawl_sessions(id), company_id TEXT NOT NULL,
 company_name TEXT NOT NULL, source_url TEXT NOT NULL, source_version TEXT NOT NULL,
 identity_key TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed',
 raw JSONB NOT NULL DEFAULT '{}', draft JSONB NOT NULL DEFAULT '{}', before_payload JSONB NOT NULL DEFAULT '{}',
 reason TEXT, job_id TEXT, base_revision BIGINT, version INTEGER NOT NULL DEFAULT 1,
 last_decision TEXT, last_input_version INTEGER, last_input JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(session_id,company_id,identity_key)
);
CREATE INDEX IF NOT EXISTS job_crawl_company_review ON job_crawl_items(company_id,status);
CREATE TABLE IF NOT EXISTS job_crawl_audit (
 id BIGSERIAL PRIMARY KEY, session_id TEXT REFERENCES job_crawl_sessions(id), item_id TEXT REFERENCES job_crawl_items(id),
 company_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
 before_payload JSONB, after_payload JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crawl_deleted_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS crawl_identity_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_manual_crawl_identity ON jobs(company_id,crawl_identity_key) WHERE crawl_identity_key IS NOT NULL;

-- Durable publication failures are retried only by an administrator.
CREATE TABLE IF NOT EXISTS job_crawl_publications (
 session_id TEXT NOT NULL REFERENCES job_crawl_sessions(id), company_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', error TEXT, version INTEGER NOT NULL DEFAULT 1,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(session_id,company_id)
);
CREATE OR REPLACE FUNCTION settle_manual_crawl(p_session TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
 UPDATE job_crawl_sessions s SET status=CASE WHEN s.mode='update' AND EXISTS(
   SELECT 1 FROM job_crawl_items i WHERE i.session_id=s.id AND i.status='proposed' AND i.kind<>'unchanged'
  ) THEN 'awaiting_review' ELSE 'complete' END,updated_at=NOW()
 WHERE s.id=p_session AND s.status<>'cancelled' AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(s.companies) c WHERE c->>'status' NOT IN ('approved','rejected','skipped','complete')
 );
END $$;
-- Compare the source configuration again while committing a human decision.
CREATE OR REPLACE FUNCTION manual_crawl_source_current(p_company TEXT,p_url TEXT,p_source JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE current_source job_sync_sources;
BEGIN
 IF p_source IS NULL THEN RETURN false; END IF;
 SELECT s.* INTO current_source FROM job_sync_sources s JOIN job_sync_source_companies m ON m.source_id=s.id
 WHERE m.company_id=p_company AND s.url=p_url ORDER BY s.revision DESC LIMIT 1 FOR SHARE OF s;
 IF p_source->>'sourceId' IS NULL THEN RETURN current_source.id IS NULL; END IF;
 RETURN current_source.id IS NOT DISTINCT FROM p_source->>'sourceId'
  AND current_source.revision IS NOT DISTINCT FROM (p_source->>'sourceRevision')::integer
  AND current_source.adapter IS NOT DISTINCT FROM p_source->>'adapter'
  AND current_source.config IS NOT DISTINCT FROM p_source->'config'
  AND current_source.capabilities IS NOT DISTINCT FROM p_source->'capabilities';
END $$;

-- One atomic commit for a bounded network step. Cancellation/retry invalidates the lease.
CREATE OR REPLACE FUNCTION save_manual_crawl_step(p_id TEXT,p_token TEXT,p_revision INTEGER,p_companies JSONB,p_status TEXT,p_items JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE s job_crawl_sessions; i JSONB;
BEGIN
 SELECT * INTO s FROM job_crawl_sessions WHERE id=p_id FOR UPDATE;
 IF s.id IS NULL OR s.status<>'running' OR s.lease_token IS DISTINCT FROM p_token OR s.revision<>p_revision OR (s.lease_until IS NULL OR s.lease_until<=NOW()) THEN RETURN false; END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF NOT (i->>'companyId'=ANY(s.company_ids)) THEN RAISE EXCEPTION 'COMPANY_MISMATCH'; END IF;
  INSERT INTO job_crawl_items(id,session_id,company_id,company_name,source_url,source_version,identity_key,kind,raw,draft,before_payload,reason,job_id,base_revision)
  VALUES(i->>'id',p_id,i->>'companyId',i->>'companyName',i->>'sourceUrl',i->>'sourceVersion',i->>'identityKey',i->>'kind',i->'raw',i->'draft',COALESCE(i->'before','{}'),i->>'reason',i->>'jobId',(i->>'baseRevision')::bigint)
  ON CONFLICT(session_id,company_id,identity_key) DO UPDATE SET status='proposed',kind=EXCLUDED.kind,raw=EXCLUDED.raw,draft=EXCLUDED.draft,before_payload=EXCLUDED.before_payload,reason=EXCLUDED.reason,job_id=EXCLUDED.job_id,base_revision=EXCLUDED.base_revision,version=job_crawl_items.version+1,source_url=EXCLUDED.source_url,source_version=EXCLUDED.source_version,created_at=NOW(),updated_at=NOW()
  WHERE job_crawl_items.status IN ('proposed','superseded');
 END LOOP;
 UPDATE job_crawl_sessions SET companies=p_companies,status=p_status,revision=revision+1,lease_token=NULL,lease_until=NULL,updated_at=NOW() WHERE id=p_id;
 PERFORM settle_manual_crawl(p_id);
 RETURN true;
END $$;

-- Control actions and qualification commits share the session lock with decisions/steps.
CREATE OR REPLACE FUNCTION control_manual_crawl(p_id TEXT,p_revision INTEGER,p_companies JSONB,p_status TEXT,p_actor TEXT,p_action TEXT,p_company TEXT,p_qualification JSONB DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE s job_crawl_sessions; co trusted_companies;
BEGIN
 SELECT * INTO s FROM job_crawl_sessions WHERE id=p_id FOR UPDATE;
 IF s.id IS NULL OR s.revision<>p_revision THEN RAISE EXCEPTION 'SESSION_CONFLICT'; END IF;
 IF p_company IS NOT NULL AND NOT(p_company=ANY(s.company_ids)) THEN RAISE EXCEPTION 'COMPANY_MISMATCH'; END IF;
 IF p_qualification IS NOT NULL THEN
  SELECT * INTO co FROM trusted_companies WHERE company_id=p_company FOR UPDATE;
  IF co.company_id IS NULL OR co.status IS DISTINCT FROM 'active' OR COALESCE(co.careers_page,'') IS DISTINCT FROM p_qualification->>'companyUrl' THEN RAISE EXCEPTION 'SOURCE_CONFLICT'; END IF;
  IF NOT manual_crawl_source_current(p_company,p_qualification->>'url',p_qualification->'source') THEN RAISE EXCEPTION 'SOURCE_CONFLICT'; END IF;
  -- The only company metadata change permitted here is the explicitly supplied recruitment URL.
  IF p_qualification->>'url' IS DISTINCT FROM COALESCE(co.careers_page,'') THEN
   UPDATE trusted_companies SET careers_page=p_qualification->>'url' WHERE company_id=p_company;
  END IF;
  INSERT INTO job_crawl_qualifications(company_id,url,source_version,status,reason,actor)
  VALUES(p_company,p_qualification->>'url',p_qualification->>'sourceVersion',p_qualification->>'status',p_qualification->>'reason',p_actor)
  ON CONFLICT(company_id) DO UPDATE SET url=EXCLUDED.url,source_version=EXCLUDED.source_version,status=EXCLUDED.status,reason=EXCLUDED.reason,actor=EXCLUDED.actor,reviewed_at=NOW();
 END IF;
 IF p_action='retry' THEN
  UPDATE job_crawl_items SET status='superseded',version=version+1 WHERE session_id=p_id AND company_id=p_company AND status='proposed';
 END IF;
 UPDATE job_crawl_sessions SET companies=p_companies,status=p_status,revision=revision+1,lease_token=NULL,lease_until=NULL,updated_at=NOW() WHERE id=p_id;
 INSERT INTO job_crawl_audit(session_id,company_id,actor,action,after_payload) VALUES(p_id,COALESCE(p_company,''),p_actor,p_action,p_qualification);
 PERFORM settle_manual_crawl(p_id);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION decide_manual_crawl(p_session TEXT,p_id TEXT,p_version INTEGER,p_action TEXT,p_patch JSONB,p_actor TEXT,p_eligible BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE s job_crawl_sessions; i job_crawl_items; co trusted_companies; old_job jobs; new_job jobs; target TEXT; k TEXT; result_status TEXT; stale_translations TEXT[];
 allowed TEXT[]:=ARRAY['title','description','url','location','salary','job_type','experience_level','is_remote','region','timezone','requirements','benefits','category','tags'];
BEGIN
 SELECT * INTO s FROM job_crawl_sessions WHERE id=p_session FOR UPDATE;
 SELECT * INTO i FROM job_crawl_items WHERE id=p_id AND session_id=p_session FOR UPDATE;
 IF i.id IS NULL OR s.id IS NULL OR NOT(i.company_id=ANY(s.company_ids)) OR s.mode<>'update' THEN RAISE EXCEPTION 'ITEM_SCOPE_INVALID'; END IF;
 IF NULLIF(p_actor,'') IS NULL THEN RAISE EXCEPTION 'ACTOR_REQUIRED'; END IF;
 -- An exact retransmission returns the saved result, even after cancellation, without a write.
 IF i.last_input_version=p_version AND i.last_decision=p_action AND i.last_input=p_patch THEN
  RETURN jsonb_build_object('id',i.id,'status',i.status,'jobId',i.job_id,'replayed',true);
 END IF;
 IF i.version IS DISTINCT FROM p_version OR i.status NOT IN ('proposed','draft','pending','deleted') THEN RAISE EXCEPTION 'REVIEW_CONFLICT'; END IF;
 IF s.status='cancelled' AND i.status='proposed' THEN RAISE EXCEPTION 'SESSION_CANCELLED'; END IF;
 IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_PATCH'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_patch) LOOP
  IF NOT k=ANY(allowed) THEN RAISE EXCEPTION 'FIELD_NOT_ALLOWED: %',k; END IF;
 END LOOP;
 IF p_action='cancel' THEN
  IF i.status IN ('deleted','pending') OR (i.status='draft' AND i.kind='create') THEN RAISE EXCEPTION '已保存的岗位请发布或删除，不能取消保存'; END IF;
  UPDATE job_crawl_items SET status='cancelled',draft='{}',last_decision=p_action,last_input_version=p_version,last_input=p_patch,version=version+1,updated_at=NOW() WHERE id=p_id;
  INSERT INTO job_crawl_audit(session_id,item_id,company_id,actor,action) VALUES(p_session,p_id,i.company_id,p_actor,p_action);
  PERFORM settle_manual_crawl(p_session);
  RETURN jsonb_build_object('id',p_id,'status','cancelled');
 END IF;
 SELECT * INTO co FROM trusted_companies WHERE company_id=i.company_id AND status='active' FOR UPDATE;
 IF co.company_id IS NULL THEN RAISE EXCEPTION 'COMPANY_REQUIRED'; END IF;
 IF p_action<>'restore' THEN
  IF NOT manual_crawl_source_current(i.company_id,i.source_url,i.raw->'source') THEN RAISE EXCEPTION 'SOURCE_CONFLICT'; END IF;
  IF COALESCE(co.careers_page,'') IS DISTINCT FROM i.source_url OR NOT EXISTS(SELECT 1 FROM job_crawl_qualifications WHERE company_id=i.company_id AND status='approved' AND url=i.source_url AND source_version=i.source_version) THEN RAISE EXCEPTION 'SOURCE_CONFLICT'; END IF;
  IF i.status='proposed' AND i.created_at<NOW()-INTERVAL '24 hours' THEN RAISE EXCEPTION 'EVIDENCE_STALE'; END IF;
 END IF;
 IF i.job_id IS NOT NULL THEN
  SELECT * INTO old_job FROM jobs WHERE job_id=i.job_id FOR UPDATE;
  IF old_job.job_id IS NULL OR old_job.company_id IS DISTINCT FROM i.company_id OR old_job.sync_revision IS DISTINCT FROM i.base_revision THEN RAISE EXCEPTION 'JOB_CONFLICT'; END IF;
 END IF;
 IF p_action='restore' THEN
  IF old_job.crawl_deleted_at IS NULL OR (i.status<>'deleted' AND i.kind<>'restore') THEN RAISE EXCEPTION 'RESTORE_CONFLICT'; END IF;
  -- Recovery is deliberately pending; publishing still requires a reviewed job.
  UPDATE jobs SET crawl_deleted_at=NULL,status='active',is_approved=false,updated_at=NOW() WHERE job_id=i.job_id;
  result_status:='pending';
 ELSIF p_action='delete' THEN
  IF old_job.job_id IS NULL OR (i.kind<>'close' AND i.status NOT IN ('draft','pending')) OR old_job.crawl_deleted_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_DELETE'; END IF;
  IF i.kind='close' AND (i.raw->>'state' IS DISTINCT FROM 'closed' OR i.raw->>'checked_at' IS NULL OR (i.raw->>'checked_at')::timestamptz<NOW()-INTERVAL '24 hours') THEN RAISE EXCEPTION 'EVIDENCE_STALE'; END IF;
  UPDATE jobs SET crawl_deleted_at=NOW(),status='inactive',is_approved=false,updated_at=NOW() WHERE job_id=i.job_id;
  result_status:='deleted';
 ELSIF p_action='pending' THEN
  IF i.kind<>'close' OR old_job.job_id IS NULL OR i.raw->>'state' IS DISTINCT FROM 'closed' OR i.raw->>'checked_at' IS NULL OR (i.raw->>'checked_at')::timestamptz<NOW()-INTERVAL '24 hours' THEN RAISE EXCEPTION 'EVIDENCE_STALE'; END IF;
  UPDATE jobs SET status='active',is_approved=false,updated_at=NOW() WHERE job_id=i.job_id;
  result_status:='pending';
 ELSIF p_action IN ('draft','publish') THEN
  IF (i.kind NOT IN ('create','update','restore') AND i.status<>'pending') OR i.status='deleted' OR old_job.crawl_deleted_at IS NOT NULL THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  IF p_action='publish' AND NOT p_eligible THEN RAISE EXCEPTION 'ELIGIBILITY_CONFIRMATION_REQUIRED'; END IF;
  new_job:=jsonb_populate_record(CASE WHEN old_job.job_id IS NULL THEN NULL::jobs ELSE old_job END,i.draft||p_patch);
  IF NULLIF(BTRIM(new_job.title),'') IS NULL OR length(COALESCE(new_job.description,''))<50 OR COALESCE(new_job.url,'') !~ '^https?://' THEN RAISE EXCEPTION 'INCOMPLETE_JOB'; END IF;
  IF old_job.job_id IS NULL THEN
   IF EXISTS(SELECT 1 FROM jobs WHERE company_id=i.company_id AND (crawl_identity_key=i.identity_key OR url=new_job.url)) THEN RAISE EXCEPTION 'DUPLICATE_JOB_CONFLICT'; END IF;
   target:='crawl-'||i.id;
   INSERT INTO jobs(job_id,title,description,url,company_id,company,company_website,company_logo,location,salary,job_type,experience_level,category,tags,requirements,benefits,is_remote,region,timezone,published_at,status,is_approved,source,source_type,is_trusted,member_only,can_refer,is_manually_edited,last_manual_verified_at,created_at,updated_at,crawl_identity_key)
   VALUES(target,new_job.title,new_job.description,new_job.url,co.company_id,co.name,co.website,co.logo,new_job.location,new_job.salary,new_job.job_type,new_job.experience_level,new_job.category,COALESCE(new_job.tags,'[]'),COALESCE(new_job.requirements,'[]'),COALESCE(new_job.benefits,'[]'),new_job.is_remote,new_job.region,new_job.timezone,NOW(),'active',p_action='publish','company-manual-crawl','official',true,COALESCE(co.member_only,false),COALESCE(co.can_refer,false),true,NOW(),NOW(),NOW(),i.identity_key);
  ELSE
   target:=old_job.job_id;
   IF p_action='publish' OR old_job.is_approved IS NOT TRUE THEN
    -- Clear only translations whose source changed; preserve company/manual metadata.
    SELECT COALESCE(array_agg(v.translation_key),ARRAY[]::text[]) INTO stale_translations
    FROM (VALUES ('title','title'),('description','description'),('description','responsibilities'),
      ('location','location'),('job_type','type'),('requirements','requirements'),('benefits','benefits')) v(source_key,translation_key)
    WHERE to_jsonb(old_job)->v.source_key IS DISTINCT FROM to_jsonb(new_job)->v.source_key;
    UPDATE jobs SET translations=old_job.translations-stale_translations,
     is_translated=CASE WHEN cardinality(stale_translations)>0 THEN false ELSE old_job.is_translated END,
      title=new_job.title,description=new_job.description,url=new_job.url,location=new_job.location,salary=new_job.salary,job_type=new_job.job_type,experience_level=new_job.experience_level,category=new_job.category,tags=new_job.tags,requirements=new_job.requirements,benefits=new_job.benefits,is_remote=new_job.is_remote,region=new_job.region,timezone=new_job.timezone,status='active',is_approved=p_action='publish',is_manually_edited=true,last_manual_verified_at=NOW(),updated_at=NOW() WHERE job_id=target;
   END IF;
  END IF;
  result_status:=CASE WHEN p_action='publish' THEN 'published' ELSE 'draft' END;
 ELSE RAISE EXCEPTION 'INVALID_DECISION';
 END IF;
 target:=COALESCE(target,i.job_id);
 UPDATE job_crawl_items SET status=result_status,job_id=target,kind=CASE WHEN i.status='pending' AND p_action IN ('draft','publish') THEN 'update' ELSE kind END,draft=CASE WHEN p_action IN ('draft','publish') THEN draft||p_patch ELSE draft END,
  base_revision=(SELECT sync_revision FROM jobs WHERE job_id=target),last_decision=p_action,last_input_version=p_version,last_input=p_patch,version=version+1,updated_at=NOW() WHERE id=p_id;
 -- Competing suggestions cannot silently overwrite this manual choice.
 UPDATE job_crawl_items SET status='superseded',version=version+1 WHERE id<>p_id AND job_id=target AND status IN ('proposed','draft','pending');
 INSERT INTO job_crawl_audit(session_id,item_id,company_id,actor,action,before_payload,after_payload)
 SELECT p_session,p_id,i.company_id,p_actor,p_action,CASE WHEN old_job.job_id IS NULL THEN NULL ELSE to_jsonb(old_job) END,to_jsonb(j) FROM jobs j WHERE job_id=target;
 UPDATE trusted_companies SET job_count=(SELECT COUNT(*) FROM jobs WHERE company_id=co.company_id AND status='active' AND is_approved IS TRUE AND crawl_deleted_at IS NULL) WHERE company_id=co.company_id;
 INSERT INTO job_crawl_publications(session_id,company_id,status) VALUES(p_session,i.company_id,'pending')
 ON CONFLICT(session_id,company_id) DO UPDATE SET status='pending',error=NULL,version=job_crawl_publications.version+1,updated_at=NOW();
 PERFORM settle_manual_crawl(p_session);
 RETURN jsonb_build_object('id',p_id,'status',result_status,'jobId',target);
END $$;
