-- v40: Power BI–ready analytics views + migration SoT note
-- Additive only. Views are read models over actual tables (no invented columns).
-- Rollback: DROP VIEW IF EXISTS for each view below (app does not depend on them at runtime).
--
-- Migration source of truth: nextjs-auth/db/migrate_v*.sql (do not add new product migrations under root db/).

-- Fact-like: submissions
CREATE OR REPLACE VIEW analytics_fact_submissions AS
SELECT
  s.id,
  s.tenant_id,
  s.resume_id AS candidate_id,
  s.job_post_id,
  s.stage AS status,
  s.created_at,
  s.updated_at
FROM submissions s;

-- Fact-like: interviews (tolerant of schema variance)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interviews') THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW analytics_fact_interviews AS
      SELECT
        i.id,
        i.tenant_id,
        i.resume_id AS candidate_id,
        i.job_post_id,
        i.status,
        i.scheduled_at,
        i.created_at
      FROM interviews i
    $v$;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'analytics_fact_interviews skipped: %', SQLERRM;
END $$;

-- Fact-like: offers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offer_cases') THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW analytics_fact_offers AS
      SELECT
        o.id,
        o.tenant_id,
        o.resume_id AS candidate_id,
        o.job_post_id,
        o.status,
        o.created_at,
        o.updated_at
      FROM offer_cases o
    $v$;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offers') THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW analytics_fact_offers AS
      SELECT
        o.id,
        o.tenant_id,
        o.resume_id AS candidate_id,
        o.job_post_id,
        o.status,
        o.created_at,
        o.updated_at
      FROM offers o
    $v$;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'analytics_fact_offers skipped: %', SQLERRM;
END $$;

-- Dimension: jobs
CREATE OR REPLACE VIEW analytics_dim_jobs AS
SELECT
  j.id,
  j.tenant_id,
  j.title,
  j.status,
  j.created_at,
  j.updated_at
FROM job_posts j;

-- Dimension: candidates (resumes) — tolerant of optional lifecycle_stage
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'lifecycle_stage'
  ) THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW analytics_dim_candidates AS
      SELECT
        r.id,
        r.tenant_id,
        r.candidate_name AS name,
        r.email,
        r.lifecycle_stage,
        r.created_at,
        r.updated_at
      FROM resumes r
    $v$;
  ELSE
    EXECUTE $v$
      CREATE OR REPLACE VIEW analytics_dim_candidates AS
      SELECT
        r.id,
        r.tenant_id,
        r.candidate_name AS name,
        r.email,
        NULL::text AS lifecycle_stage,
        r.created_at,
        r.updated_at
      FROM resumes r
    $v$;
  END IF;
END $$;

-- Dimension: clients
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW analytics_dim_clients AS
      SELECT
        c.id,
        c.tenant_id,
        c.name,
        c.created_at
      FROM clients c
    $v$;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'analytics_dim_clients skipped: %', SQLERRM;
END $$;

-- Dimension: recruiters (tenant members)
CREATE OR REPLACE VIEW analytics_dim_recruiters AS
SELECT
  tm.id,
  tm.tenant_id,
  tm.user_id,
  u.email,
  u.name,
  tm.role,
  tm.created_at
FROM tenant_members tm
JOIN auth_users u ON u.id = tm.user_id
WHERE tm.invite_accepted = TRUE;

-- Communication log fact (if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_logs') THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW analytics_fact_communications AS
      SELECT
        cl.id,
        cl.tenant_id,
        cl.channel,
        cl.direction,
        cl.status,
        cl.created_at
      FROM communication_logs cl
    $v$;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'analytics_fact_communications skipped: %', SQLERRM;
END $$;

COMMENT ON VIEW analytics_fact_submissions IS 'Power BI readiness: submission facts; always filter by tenant_id';
COMMENT ON VIEW analytics_dim_jobs IS 'Power BI readiness: job dimension; always filter by tenant_id';
COMMENT ON VIEW analytics_dim_candidates IS 'Power BI readiness: candidate dimension; PII — restrict reporting roles';
