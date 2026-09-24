import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { InvitesService } from './invites.service.js';

/** Pending invites addressed to the current user's email (no link needed). */
@Controller('users/me/invites')
export class MyInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  findAll(@CurrentUser() user: UserModel) {
    return this.invitesService.listMine(user);
  }

  @HttpCode(200)
  @Post(':inviteId/accept')
  accept(@Param('inviteId') inviteId: string, @CurrentUser() user: UserModel) {
    return this.invitesService.acceptMine(inviteId, user);
  }

  @HttpCode(200)
  @Post(':inviteId/decline')
  decline(@Param('inviteId') inviteId: string, @CurrentUser() user: UserModel) {
    return this.invitesService.declineMine(inviteId, user);
  }
}
