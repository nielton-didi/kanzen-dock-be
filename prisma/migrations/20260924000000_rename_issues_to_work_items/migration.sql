-- Rename "issues" to "work items" (product-requirements.md D5).
-- Pure renames: no rows are dropped or rewritten. Constraint and index names are
-- renamed too so they match what Prisma would generate for the new schema.

-- work_items (was issues)
ALTER TABLE "issues" RENAME TO "work_items";
ALTER TABLE "work_items" RENAME CONSTRAINT "issues_pkey" TO "work_items_pkey";
ALTER TABLE "work_items" RENAME CONSTRAINT "issues_list_id_fkey" TO "work_items_list_id_fkey";
ALTER TABLE "work_items" RENAME CONSTRAINT "issues_status_id_fkey" TO "work_items_status_id_fkey";
ALTER TABLE "work_items" RENAME CONSTRAINT "issues_assigned_to_fkey" TO "work_items_assigned_to_fkey";
ALTER TABLE "work_items" RENAME CONSTRAINT "issues_reported_by_fkey" TO "work_items_reported_by_fkey";
ALTER INDEX "issues_list_id_idx" RENAME TO "work_items_list_id_idx";
ALTER INDEX "issues_status_id_idx" RENAME TO "work_items_status_id_idx";
ALTER INDEX "issues_assigned_to_idx" RENAME TO "work_items_assigned_to_idx";
ALTER INDEX "issues_reported_by_idx" RENAME TO "work_items_reported_by_idx";

-- attachments.issue_id -> work_item_id
ALTER TABLE "attachments" RENAME COLUMN "issue_id" TO "work_item_id";
ALTER TABLE "attachments" RENAME CONSTRAINT "attachments_issue_id_fkey" TO "attachments_work_item_id_fkey";
ALTER INDEX "attachments_issue_id_idx" RENAME TO "attachments_work_item_id_idx";

-- work_item_history (was issue_history)
ALTER TABLE "issue_history" RENAME TO "work_item_history";
ALTER TABLE "work_item_history" RENAME COLUMN "issue_id" TO "work_item_id";
ALTER TABLE "work_item_history" RENAME CONSTRAINT "issue_history_pkey" TO "work_item_history_pkey";
ALTER TABLE "work_item_history" RENAME CONSTRAINT "issue_history_issue_id_fkey" TO "work_item_history_work_item_id_fkey";
ALTER TABLE "work_item_history" RENAME CONSTRAINT "issue_history_changed_by_fkey" TO "work_item_history_changed_by_fkey";
ALTER INDEX "issue_history_issue_id_idx" RENAME TO "work_item_history_work_item_id_idx";
ALTER INDEX "issue_history_changed_by_idx" RENAME TO "work_item_history_changed_by_idx";
ALTER INDEX "issue_history_changed_at_idx" RENAME TO "work_item_history_changed_at_idx";
