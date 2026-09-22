import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateListDto } from './dto/create-list.dto.js';
import { ListsService } from './lists.service.js';

@Controller('projects/:projectId/lists')
export class ProjectListsController {
  constructor(private readonly listsService: ListsService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateListDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.listsService.create(projectId, dto, user.id);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.listsService.findAllByProject(projectId, user.id);
  }
}
