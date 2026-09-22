import { Body, Controller, Delete, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { DeleteStatusDto } from './dto/delete-status.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { StatusesService } from './statuses.service.js';

@Controller('statuses')
export class StatusesController {
  constructor(private readonly statusesService: StatusesService) {}

  @Put(':statusId')
  update(
    @Param('statusId') statusId: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.statusesService.update(statusId, dto, user.id);
  }

  @Delete(':statusId')
  remove(
    @Param('statusId') statusId: string,
    @Body() dto: DeleteStatusDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.statusesService.remove(statusId, dto, user.id);
  }
}
