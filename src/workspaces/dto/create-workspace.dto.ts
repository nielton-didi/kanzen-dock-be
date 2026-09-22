import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
