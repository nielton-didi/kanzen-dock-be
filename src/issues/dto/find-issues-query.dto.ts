import { IsIn, IsOptional, IsString } from 'class-validator';

const TYPES = ['bug', 'task'] as const;
const STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
  'wont_fix',
] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const PRIORITIES = ['high', 'medium', 'low'] as const;

export class FindIssuesQueryDto {
  @IsOptional()
  @IsIn(TYPES)
  type?: (typeof TYPES)[number];

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: (typeof PRIORITIES)[number];

  @IsOptional()
  @IsString()
  assigned_to?: string;
}
