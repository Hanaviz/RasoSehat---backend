-- Migration: Ensure one restaurant per user
-- Safe steps to enforce UNIQUE constraint on restorans.user_id
-- IMPORTANT: Run in a maintenance window on production. Backup the table before running.

-- 0) Backup (recommended)
-- CREATE TABLE restorans_backup AS TABLE restorans;

-- 1) Inspect duplicates (rows with same user_id)
-- SELECT user_id, count(*) AS cnt
-- FROM restorans
-- WHERE user_id IS NOT NULL
-- GROUP BY user_id
-- HAVING count(*) > 1;

-- 2) For users that have >1 restaurant, keep the most recent (created_at DESC) and clear the user_id on older rows.
-- This preserves older records but removes the association so the UNIQUE constraint can be added safely.

-- IMPORTANT: some schemas define `user_id` as NOT NULL. In that case, attempting to set
-- user_id = NULL will fail (as in your screenshot). To avoid that, drop the NOT NULL
-- constraint first, then null older duplicates, then add UNIQUE.

BEGIN;

-- 2a) Allow NULLs temporarily on user_id so we can clear older duplicates
ALTER TABLE restorans ALTER COLUMN user_id DROP NOT NULL;

-- 2b) Null out user_id on older duplicate restaurants (keep newest per user)
WITH ranked AS (
  SELECT id, user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
  FROM restorans
  WHERE user_id IS NOT NULL
)
UPDATE restorans r
SET user_id = NULL
FROM ranked rnk
WHERE r.id = rnk.id
  AND rnk.rn > 1;

-- 2c) (Optional) Verify duplicates resolved before adding constraint
-- SELECT user_id, count(*) AS cnt
-- FROM restorans
-- WHERE user_id IS NOT NULL
-- GROUP BY user_id
-- HAVING count(*) > 1;

-- 3) Add UNIQUE constraint on user_id (NULLs allowed; many NULLs ok)
ALTER TABLE restorans
ADD CONSTRAINT restorans_user_id_unique UNIQUE (user_id);

COMMIT;

-- 3) (Optional) Verify duplicates resolved
-- SELECT user_id, count(*) AS cnt
-- FROM restorans
-- WHERE user_id IS NOT NULL
-- GROUP BY user_id
-- HAVING count(*) > 1;

-- 4) Add UNIQUE constraint on user_id (NULLs allowed; many NULLs ok)
ALTER TABLE restorans
ADD CONSTRAINT restorans_user_id_unique UNIQUE (user_id);

-- 5) (Optional) If you prefer to delete older records instead of nulling user_id, replace the UPDATE above with a DELETE.

-- Notes:
-- - This migration sets user_id = NULL on all but the newest restaurant per user. That prevents accidental reassignment.
-- - If you want to preserve a mapping, consider archiving older rows to another table before clearing user_id.
-- - Test these steps on a staging DB first.
