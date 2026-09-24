import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { ListsController } from './lists.controller.js';
import { ListTemplatesController } from './list-templates.controller.js';
import { ListsService } from './lists.service.js';
import { ProjectListsController } from './project-lists.controller.js';

@Module({
  imports: [ProjectsModule, WorkspacesModule],
  controllers: [
    ProjectListsController,
    ListsController,
    ListTemplatesController,
  ],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}
