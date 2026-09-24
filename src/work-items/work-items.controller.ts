import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { UpdateWorkItemDto } from './dto/update-work-item.dto.js';
import { WorkItemsService } from './work-items.service.js';

@Controller('work-items')
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Get(':workItemId')
  findOne(@Param('workItemId') workItemId: string, @CurrentUser() user: UserModel) {
    return this.workItemsService.findOne(workItemId, user.id);
  }

  @Put(':workItemId')
  update(
    @Param('workItemId') workItemId: string,
    @Body() dto: UpdateWorkItemDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.workItemsService.update(workItemId, dto, user.id);
  }

  @Get(':workItemId/history')
  getHistory(
    @Param('workItemId') workItemId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.workItemsService.getHistory(workItemId, user.id);
  }

  @Delete(':workItemId')
  remove(@Param('workItemId') workItemId: string, @CurrentUser() user: UserModel) {
    return this.workItemsService.remove(workItemId, user.id);
  }
}
