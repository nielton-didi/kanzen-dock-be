import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateListDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  /** Moves the list to another project in the same workspace. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  project_id?: string;
}
