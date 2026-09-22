import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const TYPES = ['bug', 'task'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const PRIORITIES = ['high', 'medium', 'low'] as const;

// Query parsing gives a bare string for a single occurrence (`?type=bug`) and
// an array for repeated ones (`?type=bug&type=task`) - normalize both to an
// array so the filter is always multi-value from here on.
function toArray({ value }: { value: unknown }): unknown {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

export class FindIssuesQueryDto {
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
}
