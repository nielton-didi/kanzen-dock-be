/*
  Warnings:

  - Added the required column `status_id` to the `issues` table without a default value.
    The app is pre-launch, so existing `issues` rows (and their cascaded `issue_history`
    and `attachments` rows) are deleted rather than backfilled — there is no sensible
    mapping from the old global status strings to the new per-list custom statuses.
  - You are about to drop the column `status` on the `issues` table.

*/
-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('not_started', 'active', 'done', 'closed');

-- CreateTable
CREATE TABLE "statuses" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" "StatusCategory" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "statuses_list_id_idx" ON "statuses"("list_id");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_list_id_category_position_key" ON "statuses"("list_id", "category", "position");

-- CreateIndex
CREATE UNIQUE INDEX "statuses_list_id_name_key" ON "statuses"("list_id", "name");

-- AddForeignKey
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pre-launch data wipe: no sensible backfill exists from the old global status
-- strings to new per-list custom statuses. Cascades to issue_history and attachments.
DELETE FROM "issues";

-- AlterTable
ALTER TABLE "issues" DROP COLUMN "status",
ADD COLUMN     "status_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "issues_status_id_idx" ON "issues"("status_id");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
