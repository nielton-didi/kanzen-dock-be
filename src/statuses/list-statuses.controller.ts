import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateStatusDto } from './dto/create-status.dto.js';
import { ReorderStatusesDto } from './dto/reorder-statuses.dto.js';
import { StatusesService } from './statuses.service.js';

@Controller('lists/:listId/statuses')
export class ListStatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @Get()
  findAll(@Param('listId') listId: string, @CurrentUser() user: UserModel) {
    return this.statusesService.findAllByList(listId, user.id);
  }

  @Post()
  create(
    @Param('listId') listId: string,
    @Body() dto: CreateStatusDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.statusesService.create(listId, dto, user.id);
  }

  @Patch('reorder')
  reorder(
    @Param('listId') listId: string,
    @Body() dto: ReorderStatusesDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.statusesService.reorder(listId, dto, user.id);
  }
}
