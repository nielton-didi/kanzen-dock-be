import { Module } from '@nestjs/common';
import { InviteLinksController } from './invite-links.controller.js';
import { InvitesService } from './invites.service.js';
import { MembersService } from './members.service.js';
import { MyInvitesController } from './my-invites.controller.js';
import { WorkspaceInvitesController } from './workspace-invites.controller.js';
import { WorkspaceMembersController } from './workspace-members.controller.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  controllers: [
    WorkspacesController,
    WorkspaceMembersController,
    WorkspaceInvitesController,
    InviteLinksController,
    MyInvitesController,
  ],
  providers: [WorkspacesService, MembersService, InvitesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
