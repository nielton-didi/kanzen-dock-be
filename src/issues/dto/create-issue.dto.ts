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

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  /** Only allowed when type is "bug" — enforced in IssuesService. */
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];
}
