import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { UpdateListDto } from './dto/update-list.dto.js';
import { ListsService } from './lists.service.js';

@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get(':listId')
  findOne(@Param('listId') listId: string, @CurrentUser() user: UserModel) {
    return this.listsService.findOne(listId, user.id);
  }

  @Put(':listId')
  update(
    @Param('listId') listId: string,
    @Body() dto: UpdateListDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.listsService.update(listId, dto, user.id);
  }

  @Delete(':listId')
  remove(@Param('listId') listId: string, @CurrentUser() user: UserModel) {
    return this.listsService.remove(listId, user.id);
  }
}
