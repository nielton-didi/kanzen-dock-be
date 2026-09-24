import { IsIn } from 'class-validator';
import { ASSIGNABLE_ROLES, type AssignableRole } from '../workspace-roles.js';

export class UpdateMemberRoleDto {
  @IsIn(ASSIGNABLE_ROLES)
  role!: AssignableRole;
}
