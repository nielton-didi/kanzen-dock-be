import {
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DATE_ONLY_PATTERN, PRIORITIES } from '../work-item-fields.const.js';

const TYPES = ['bug', 'task'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export class CreateWorkItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  /** Only allowed when type is "bug" — enforced in WorkItemsService. */
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

  /** Defaults to the list's default status when omitted — checked in WorkItemsService (a fixed @IsIn can't validate per-list values). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status_id?: string;
}
