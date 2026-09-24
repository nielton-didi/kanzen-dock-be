import { Transform } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { DATE_ONLY_PATTERN, PRIORITIES } from '../work-item-fields.const.js';

const TYPES = ['bug', 'task'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

// Query parsing gives a bare string for a single occurrence (`?type=bug`) and
// an array for repeated ones (`?type=bug&type=task`) - normalize both to an
// array so the filter is always multi-value from here on.
function toArray({ value }: { value: unknown }): unknown {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

export class FindWorkItemsQueryDto {
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(TYPES, { each: true })
  type?: (typeof TYPES)[number][];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  status_id?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(SEVERITIES, { each: true })
  severity?: (typeof SEVERITIES)[number][];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(PRIORITIES, { each: true })
  priority?: (typeof PRIORITIES)[number][];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  assigned_to?: string[];

  /** Inclusive lower bound on due_date (`YYYY-MM-DD`); excludes work items with no due date. */
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: '$property must be a YYYY-MM-DD date' })
  @IsISO8601({ strict: true })
  due_from?: string;

  /** Inclusive upper bound on due_date (`YYYY-MM-DD`); excludes work items with no due date. */
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: '$property must be a YYYY-MM-DD date' })
  @IsISO8601({ strict: true })
  due_to?: string;

  /**
   * Custom field filters, `<fieldId>:<value>` (repeat for more). Values for the
   * same field are OR'd, different fields AND'd. dropdown / multi_select take an
   * option id, person a user id, checkbox `true` / `false`.
   */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  cf?: string[];
}
