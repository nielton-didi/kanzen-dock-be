import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { UpdateListPreferenceDto } from './dto/update-list-preference.dto.js';
import { ListPreferencesService } from './list-preferences.service.js';

/** The current user's own view settings for a list (D6). */
@Controller('lists/:listId/preferences/me')
export class ListPreferencesController {
  constructor(
    private readonly listPreferencesService: ListPreferencesService,
  ) {}

  @Get()
  findMine(@Param('listId') listId: string, @CurrentUser() user: UserModel) {
    return this.listPreferencesService.findMine(listId, user.id);
  }

  @Put()
  updateMine(
    @Param('listId') listId: string,
    @Body() dto: UpdateListPreferenceDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.listPreferencesService.updateMine(listId, dto, user.id);
  }
}
