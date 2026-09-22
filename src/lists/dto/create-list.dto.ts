import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const LIST_TYPES = ['bug', 'task', 'feature', 'backlog'] as const;

export class CreateListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsIn(LIST_TYPES)
  type!: (typeof LIST_TYPES)[number];
}
