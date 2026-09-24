import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { InvitesService } from './invites.service.js';

/** Owner/admin side of invites. Create and resend return the link `token` once. */
@Controller('workspaces/:workspaceId/invites')
export class WorkspaceInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.invitesService.list(workspaceId, user.id);
  }

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateInviteDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.invitesService.create(workspaceId, dto, user.id);
  }

  @HttpCode(200)
  @Post(':inviteId/resend')
  resend(
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.invitesService.resend(workspaceId, inviteId, user.id);
  }

  @Delete(':inviteId')
  revoke(
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.invitesService.revoke(workspaceId, inviteId, user.id);
  }
}
