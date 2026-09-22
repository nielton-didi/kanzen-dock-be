import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const TYPES = ['bug', 'task'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const PRIORITIES = ['high', 'medium', 'low'] as const;

export class UpdateIssueDto {
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

  /** Must belong to the issue's list — checked in IssuesService, not here (a fixed @IsIn can't validate per-list values). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status_id?: string;

  /** Only allowed when the issue's (possibly just-updated) type is "bug" — enforced in IssuesService. */
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  /** User id to assign to, or null to unassign. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  assigned_to?: string | null;
}
