-- Notification metadata only. No jobs/company UPDATEs, triggers or schedules.
CREATE TABLE IF NOT EXISTS company_list_check_states (
 company_id text PRIMARY KEY,
 source_url text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'unchecked',
 failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
 findings jsonb NOT NULL DEFAULT '[]',
 dismissed jsonb NOT NULL DEFAULT '[]',
 reasons jsonb NOT NULL DEFAULT '[]',
 candidates jsonb NOT NULL DEFAULT '[]',
 candidate_count integer NOT NULL DEFAULT 0,
 checked_at timestamptz,
 lease_token text,
 lease_until timestamptz,
 actor text,
 pages integer NOT NULL DEFAULT 0,
 listed_count integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS company_list_check_runs (
 id text PRIMARY KEY,
 actor text NOT NULL,
 request_id text NOT NULL,
 company_ids text[] NOT NULL,
 reset boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor,request_id)
);
CREATE TABLE IF NOT EXISTS company_list_check_attempts (
 run_id text NOT NULL REFERENCES company_list_check_runs(id),
 company_id text NOT NULL,
 company_name text NOT NULL,
 source_url text NOT NULL,
 status text NOT NULL DEFAULT 'queued',
 result jsonb,
 started_at timestamptz,
 finished_at timestamptz,
 PRIMARY KEY(run_id,company_id)
);
CREATE INDEX IF NOT EXISTS company_list_check_history ON company_list_check_attempts(company_id,finished_at DESC);
