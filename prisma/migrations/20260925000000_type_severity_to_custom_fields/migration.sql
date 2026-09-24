-- P0-4 (D4): work item `type` / `severity` become per-list dropdown custom
-- fields, and deleting a custom field becomes recoverable (`deleted_at`).
--
-- Every existing list gets a "Type" and a "Severity" dropdown field (appended
-- after its active fields). Each work item's values are copied into
-- custom_fields as option ids, and the old `type` / `severity` history rows are
-- rewritten to the `cf:<fieldId>` convention with JSON-encoded option ids, so
-- the activity feed labels them through the field definitions. Option labels
-- and colors match the Bug tracking template (P0-6): Critical red, High orange,
-- Medium/Low gray. Destructive (drops two columns): the DO block aborts the
-- migration if any value can't be mapped or any copy count doesn't match.

-- Recoverable delete: names are unique among a list's active fields only.
-- DropIndex
DROP INDEX "field_definitions_list_id_name_key";

-- AlterTable
ALTER TABLE "field_definitions" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_list_id_name_key" ON "field_definitions"("list_id", "name") WHERE (deleted_at IS NULL);

-- Data migration
DO $$
DECLARE
  list_row RECORD;
  type_field TEXT;
  severity_field TEXT;
  next_position INT;
  opt_bug TEXT;
  opt_task TEXT;
  opt_critical TEXT;
  opt_high TEXT;
  opt_medium TEXT;
  opt_low TEXT;
  expected INT;
  actual INT;
BEGIN
  IF EXISTS (SELECT 1 FROM work_items WHERE type NOT IN ('bug', 'task')) THEN
    RAISE EXCEPTION 'P0-4: work_items.type has values other than bug/task';
  END IF;
  IF EXISTS (
    SELECT 1 FROM work_items
    WHERE severity IS NOT NULL AND severity NOT IN ('critical', 'high', 'medium', 'low')
  ) THEN
    RAISE EXCEPTION 'P0-4: work_items.severity has unexpected values';
  END IF;
  IF EXISTS (SELECT 1 FROM field_definitions WHERE name IN ('Type', 'Severity')) THEN
    RAISE EXCEPTION 'P0-4: a list already has a field named Type or Severity';
  END IF;

  FOR list_row IN SELECT id FROM lists LOOP
    type_field := gen_random_uuid()::text;
    severity_field := gen_random_uuid()::text;
    opt_bug := gen_random_uuid()::text;
    opt_task := gen_random_uuid()::text;
    opt_critical := gen_random_uuid()::text;
    opt_high := gen_random_uuid()::text;
    opt_medium := gen_random_uuid()::text;
    opt_low := gen_random_uuid()::text;

    SELECT COALESCE(MAX(position) + 1, 0) INTO next_position
    FROM field_definitions WHERE list_id = list_row.id;

    INSERT INTO field_definitions (id, list_id, name, kind, options, position, updated_at)
    VALUES
      (type_field, list_row.id, 'Type', 'dropdown', jsonb_build_array(
        jsonb_build_object('id', opt_bug, 'label', 'Bug', 'color', 'red'),
        jsonb_build_object('id', opt_task, 'label', 'Task', 'color', 'blue')
      ), next_position, CURRENT_TIMESTAMP),
      (severity_field, list_row.id, 'Severity', 'dropdown', jsonb_build_array(
        jsonb_build_object('id', opt_critical, 'label', 'Critical', 'color', 'red'),
        jsonb_build_object('id', opt_high, 'label', 'High', 'color', 'orange'),
        jsonb_build_object('id', opt_medium, 'label', 'Medium', 'color', 'gray'),
        jsonb_build_object('id', opt_low, 'label', 'Low', 'color', 'gray')
      ), next_position + 1, CURRENT_TIMESTAMP);

    -- Values (a partial merge, like the API; updated_at is left alone).
    UPDATE work_items
    SET custom_fields = custom_fields || jsonb_build_object(
      type_field, CASE type WHEN 'bug' THEN opt_bug ELSE opt_task END)
    WHERE list_id = list_row.id;

    UPDATE work_items
    SET custom_fields = custom_fields || jsonb_build_object(
      severity_field, CASE severity
        WHEN 'critical' THEN opt_critical
        WHEN 'high' THEN opt_high
        WHEN 'medium' THEN opt_medium
        ELSE opt_low
      END)
    WHERE list_id = list_row.id AND severity IS NOT NULL;

    -- History: stored values become JSON-encoded option ids (unmapped -> NULL).
    UPDATE work_item_history h
    SET field_name = 'cf:' || type_field,
        old_value = CASE h.old_value
          WHEN 'bug' THEN to_jsonb(opt_bug)::text
          WHEN 'task' THEN to_jsonb(opt_task)::text
        END,
        new_value = CASE h.new_value
          WHEN 'bug' THEN to_jsonb(opt_bug)::text
          WHEN 'task' THEN to_jsonb(opt_task)::text
        END
    FROM work_items w
    WHERE h.work_item_id = w.id AND w.list_id = list_row.id AND h.field_name = 'type';

    UPDATE work_item_history h
    SET field_name = 'cf:' || severity_field,
        old_value = CASE h.old_value
          WHEN 'critical' THEN to_jsonb(opt_critical)::text
          WHEN 'high' THEN to_jsonb(opt_high)::text
          WHEN 'medium' THEN to_jsonb(opt_medium)::text
          WHEN 'low' THEN to_jsonb(opt_low)::text
        END,
        new_value = CASE h.new_value
          WHEN 'critical' THEN to_jsonb(opt_critical)::text
          WHEN 'high' THEN to_jsonb(opt_high)::text
          WHEN 'medium' THEN to_jsonb(opt_medium)::text
          WHEN 'low' THEN to_jsonb(opt_low)::text
        END
    FROM work_items w
    WHERE h.work_item_id = w.id AND w.list_id = list_row.id AND h.field_name = 'severity';
  END LOOP;

  -- Every value copied: each work item holds exactly one Type value, and one
  -- Severity value iff it had a severity.
  SELECT COUNT(*) INTO expected FROM work_items;
  SELECT COUNT(*) INTO actual
  FROM work_items w JOIN field_definitions f ON f.list_id = w.list_id AND f.name = 'Type'
  WHERE jsonb_exists(w.custom_fields, f.id);
  IF actual <> expected THEN
    RAISE EXCEPTION 'P0-4: copied % of % type values', actual, expected;
  END IF;

  SELECT COUNT(*) INTO expected FROM work_items WHERE severity IS NOT NULL;
  SELECT COUNT(*) INTO actual
  FROM work_items w JOIN field_definitions f ON f.list_id = w.list_id AND f.name = 'Severity'
  WHERE jsonb_exists(w.custom_fields, f.id);
  IF actual <> expected THEN
    RAISE EXCEPTION 'P0-4: copied % of % severity values', actual, expected;
  END IF;

  IF EXISTS (SELECT 1 FROM work_item_history WHERE field_name IN ('type', 'severity')) THEN
    RAISE EXCEPTION 'P0-4: unmigrated type/severity history rows remain';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "work_items" DROP COLUMN "severity",
DROP COLUMN "type";
