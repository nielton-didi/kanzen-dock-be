import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { MembersService } from './members.service.js';

/** `:userId` is the member's user id. */
@Controller('workspaces/:workspaceId/members')
export class WorkspaceMembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.membersService.list(workspaceId, user.id);
  }

  @Patch(':userId')
  updateRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.membersService.updateRole(
      workspaceId,
      userId,
      dto.role,
      user.id,
    );
  }

  @Delete(':userId')
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.membersService.remove(workspaceId, userId, user.id);
  }
}
