-- Interview pipeline: allow to_schedule / selected and keep interviewer_id in sync.
-- Idempotent. Does not drop data.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.interviews'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.interviews DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interviews_status_check'
  ) THEN
    ALTER TABLE public.interviews
      ADD CONSTRAINT interviews_status_check CHECK (status IN (
        'to_schedule', 'scheduled', 'rescheduled', 'postponed', 'confirmed', 'completed',
        'no_show', 'interviewer_no_show', 'cancelled', 'rejected', 'selected',
        'awaiting_feedback', 'offer_discussion', 'offer_released',
        'offer_accepted', 'offer_rejected'
      ));
  END IF;
END $$;

ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS interviewer_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'interviews' AND column_name = 'user_id'
  ) THEN
    UPDATE public.interviews
       SET interviewer_id = COALESCE(interviewer_id, user_id)
     WHERE interviewer_id IS NULL;
  END IF;
END $$;
