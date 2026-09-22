import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeleteStatusDto {
  /** Required when issues still use this status — they're moved here before it's deleted. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reassign_to_status_id?: string;
}
