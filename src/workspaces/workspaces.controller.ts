import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: UserModel) {
    return this.workspacesService.create(dto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: UserModel) {
    return this.workspacesService.getUserWorkspaces(user.id);
  }

  @Get(':workspaceId')
  findOne(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.workspacesService.getWorkspace(workspaceId, user.id);
  }

  @Post(':workspaceId/invite')
  inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.workspacesService.inviteMember(workspaceId, dto, user.id);
  }

  @Delete(':workspaceId/members/:memberId')
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.workspacesService.removeMember(workspaceId, memberId, user.id);
  }
}
