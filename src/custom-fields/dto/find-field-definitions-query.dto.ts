import { IsIn, IsOptional } from 'class-validator';

export class FindFieldDefinitionsQueryDto {
  /** `true` lists the list's soft-deleted fields instead of its active ones. */
  @IsOptional()
  @IsIn(['true', 'false'])
  deleted?: 'true' | 'false';
}
