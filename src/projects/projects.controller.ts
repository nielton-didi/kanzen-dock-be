import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.projectsService.create(workspaceId, dto, user.id);
  }

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.projectsService.findAllByWorkspace(workspaceId, user.id);
  }

  @Delete(':projectId')
  remove(
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.projectsService.remove(projectId, user.id);
  }
}
