import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const TYPES = ['bug', 'task'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const PRIORITIES = ['high', 'medium', 'low'] as const;

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

  /** Defaults to the list's default status when omitted — checked in WorkItemsService (a fixed @IsIn can't validate per-list values). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status_id?: string;
}
