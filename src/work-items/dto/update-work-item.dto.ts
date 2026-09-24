import {
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DATE_ONLY_PATTERN, PRIORITIES } from '../work-item-fields.const.js';

const TYPES = ['bug', 'task'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export class UpdateWorkItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(TYPES)
  type?: (typeof TYPES)[number];

  /** Must belong to the work item's list — checked in WorkItemsService, not here (a fixed @IsIn can't validate per-list values). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status_id?: string;

  /** Only allowed when the work item's (possibly just-updated) type is "bug" — enforced in WorkItemsService. */
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  /** Calendar day, `YYYY-MM-DD`. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DATE_ONLY_PATTERN, { message: '$property must be a YYYY-MM-DD date' })
  @IsISO8601({ strict: true })
  start_date?: string | null;

  /** Calendar day, `YYYY-MM-DD`. Must not be before start_date — checked in WorkItemsService. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DATE_ONLY_PATTERN, { message: '$property must be a YYYY-MM-DD date' })
  @IsISO8601({ strict: true })
  due_date?: string | null;

  /** User id to assign to, or null to unassign. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  assigned_to?: string | null;

  /** Values keyed by custom field id; `null` unsets. Validated against the list's fields in custom-field-values.ts. */
  @IsOptional()
  @IsObject()
  custom_fields?: Record<string, unknown>;
}
