/*
  Warnings:

  - You are about to drop the column `type` on the `lists` table. All the data in the column will be lost.
  - Added the required column `type` to the `issues` table. Existing rows are backfilled to 'bug'.
  - Made the column `severity` on the `issues` table optional (no default). Only meaningful when `type` is 'bug'.

*/
-- AlterTable
ALTER TABLE "lists" DROP COLUMN "type";

-- AlterTable: add "type", backfilling existing rows to 'bug', then drop the temporary default
ALTER TABLE "issues" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'bug';
ALTER TABLE "issues" ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable: severity becomes optional and loses its default, since it's now bug-only
ALTER TABLE "issues" ALTER COLUMN "severity" DROP NOT NULL;
ALTER TABLE "issues" ALTER COLUMN "severity" DROP DEFAULT;
