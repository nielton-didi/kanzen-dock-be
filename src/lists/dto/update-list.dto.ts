import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateListDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}
