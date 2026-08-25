-- v38: Historical bulk-queue failures are not a live outage.
-- Completed jobs can still have leftover `failed` CV rows (old JSON/AI errors).
-- Those inflated /api/health queues.failedItems forever (prod showed 26 with failedJobs=0).
-- Idempotent: later deploys match 0 rows.

UPDATE bulk_screening_items i
SET
  status = 'abandoned',
  error = CASE
    WHEN i.error IS NULL OR btrim(i.error) = '' THEN 'abandoned: parent job already completed'
    WHEN i.error LIKE '%abandoned: parent job already completed%' THEN i.error
    ELSE left(i.error, 800) || ' | abandoned: parent job already completed'
  END,
  updated_at = NOW()
FROM bulk_screening_jobs j
WHERE i.bulk_job_id = j.id
  AND i.status = 'failed'
  AND j.status = 'completed';

UPDATE bulk_screening_jobs j
SET
  failed = (
    SELECT COUNT(*)::int
    FROM bulk_screening_items i
    WHERE i.bulk_job_id = j.id
      AND i.status = 'failed'
  ),
  skipped = (
    SELECT COUNT(*)::int
    FROM bulk_screening_items i
    WHERE i.bulk_job_id = j.id
      AND i.status IN ('skipped', 'abandoned')
  ),
  updated_at = NOW()
WHERE j.status = 'completed';
