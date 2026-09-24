import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CustomFieldsService } from './custom-fields.service.js';
import { CreateFieldDefinitionDto } from './dto/create-field-definition.dto.js';
import { FindFieldDefinitionsQueryDto } from './dto/find-field-definitions-query.dto.js';
import { ReorderFieldDefinitionsDto } from './dto/reorder-field-definitions.dto.js';

@Controller('lists/:listId/custom-fields')
export class ListCustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  findAll(
    @Param('listId') listId: string,
    @Query() query: FindFieldDefinitionsQueryDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.customFieldsService.findAllByList(
      listId,
      user.id,
      query.deleted === 'true',
    );
  }

  @Post()
  create(
    @Param('listId') listId: string,
    @Body() dto: CreateFieldDefinitionDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.customFieldsService.create(listId, dto, user.id);
  }

  @Patch('reorder')
  reorder(
    @Param('listId') listId: string,
    @Body() dto: ReorderFieldDefinitionsDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.customFieldsService.reorder(listId, dto, user.id);
  }
}
