import { IsEmail, IsIn, IsOptional, MaxLength } from 'class-validator';
import { ASSIGNABLE_ROLES, type AssignableRole } from '../workspace-roles.js';

export class CreateInviteDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: AssignableRole;
}
