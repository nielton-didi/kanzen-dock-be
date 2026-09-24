import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CustomFieldsService } from './custom-fields.service.js';
import { UpdateFieldDefinitionDto } from './dto/update-field-definition.dto.js';

@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Put(':fieldId')
  update(
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFieldDefinitionDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.customFieldsService.update(fieldId, dto, user.id);
  }

  @Delete(':fieldId')
  remove(@Param('fieldId') fieldId: string, @CurrentUser() user: UserModel) {
    return this.customFieldsService.remove(fieldId, user.id);
  }

  @Post(':fieldId/restore')
  @HttpCode(200)
  restore(@Param('fieldId') fieldId: string, @CurrentUser() user: UserModel) {
    return this.customFieldsService.restore(fieldId, user.id);
  }
}
