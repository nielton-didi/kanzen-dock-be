import { IsNotEmpty, IsString } from 'class-validator';

export class TransferOwnershipDto {
  @IsString()
  @IsNotEmpty()
  user_id!: string;
}
