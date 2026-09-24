-- P0-1: priority gains `urgent` and `none` (validated in the API, the column
-- stays TEXT) and new work items default to `none`. Existing high/medium/low
-- values remain valid. Start/due dates are calendar days, both optional.
ALTER TABLE "work_items" ADD COLUMN     "due_date" DATE,
ADD COLUMN     "start_date" DATE,
ALTER COLUMN "priority" SET DEFAULT 'none';
