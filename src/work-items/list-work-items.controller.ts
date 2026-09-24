import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateWorkItemDto } from './dto/create-work-item.dto.js';
import { FindWorkItemsQueryDto } from './dto/find-work-items-query.dto.js';
import { WorkItemsService } from './work-items.service.js';

@Controller('lists/:listId/work-items')
export class ListWorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Post()
  create(
    @Param('listId') listId: string,
    @Body() dto: CreateWorkItemDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.workItemsService.create(listId, dto, user.id);
  }

  @Get()
  findAll(
    @Param('listId') listId: string,
    @Query() query: FindWorkItemsQueryDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.workItemsService.findAllByList(listId, user.id, query);
  }
}
