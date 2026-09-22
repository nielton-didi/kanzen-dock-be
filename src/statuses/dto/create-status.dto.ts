import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
