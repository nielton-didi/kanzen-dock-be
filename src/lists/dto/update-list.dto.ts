import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const LIST_TYPES = ['bug', 'task', 'feature', 'backlog'] as const;

export class UpdateListDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(LIST_TYPES)
  type?: (typeof LIST_TYPES)[number];
}
