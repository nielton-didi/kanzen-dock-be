-- P0-3: per-list custom field definitions (D2) and work item values in a JSONB
-- column keyed by field id. The GIN index (jsonb_path_ops) serves containment
-- filters (custom_fields @> '{"<fieldId>": "<optionId>"}'). Additive only.
-- AlterTable
ALTER TABLE "work_items" ADD COLUMN     "custom_fields" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_definitions_list_id_idx" ON "field_definitions"("list_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_list_id_name_key" ON "field_definitions"("list_id", "name");

-- CreateIndex
CREATE INDEX "work_items_custom_fields_idx" ON "work_items" USING GIN ("custom_fields" jsonb_path_ops);

-- AddForeignKey
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

