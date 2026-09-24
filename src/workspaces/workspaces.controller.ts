import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { MembersService } from './members.service.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly membersService: MembersService,
  ) {}

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

  @Patch(':workspaceId')
  rename(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.workspacesService.rename(workspaceId, dto, user.id);
  }

  @HttpCode(200)
  @Post(':workspaceId/leave')
  leave(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.membersService.leave(workspaceId, user.id);
  }

  @HttpCode(200)
  @Post(':workspaceId/transfer-ownership')
  transferOwnership(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.workspacesService.transferOwnership(
      workspaceId,
      dto.user_id,
      user.id,
    );
  }

  @Delete(':workspaceId')
  remove(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.workspacesService.remove(workspaceId, user.id);
  }
}
