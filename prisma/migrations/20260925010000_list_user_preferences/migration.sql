-- P0-8 / D6: per-user, per-list view preferences (custom fields shown as
-- columns in list rows). Additive only.
-- CreateTable
CREATE TABLE "list_user_preferences" (
    "list_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "row_field_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_user_preferences_pkey" PRIMARY KEY ("list_id","user_id")
);

-- CreateIndex
CREATE INDEX "list_user_preferences_user_id_idx" ON "list_user_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "list_user_preferences" ADD CONSTRAINT "list_user_preferences_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_user_preferences" ADD CONSTRAINT "list_user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

