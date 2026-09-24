import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { InvitesService } from './invites.service.js';

/** The `/invite/<token>` link: a public preview, and accept once logged in. */
@Controller('invite-links')
export class InviteLinksController {
  constructor(private readonly invitesService: InvitesService) {}

  @Public()
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitesService.preview(token);
  }

  @HttpCode(200)
  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: UserModel) {
    return this.invitesService.acceptByToken(token, user);
  }
}
