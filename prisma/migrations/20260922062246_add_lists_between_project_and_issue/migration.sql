/*
  Warnings:

  - You are about to drop the column `project_id` on the `issues` table. All the data in the column will be lost.
  - Added the required column `list_id` to the `issues` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_project_id_fkey";

-- DropIndex
DROP INDEX "issues_project_id_idx";

-- AlterTable
ALTER TABLE "issues" DROP COLUMN "project_id",
ADD COLUMN     "list_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lists_project_id_idx" ON "lists"("project_id");

-- CreateIndex
CREATE INDEX "issues_list_id_idx" ON "issues"("list_id");

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
