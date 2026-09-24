import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module.js';
import { CustomFieldsController } from './custom-fields.controller.js';
import { CustomFieldsService } from './custom-fields.service.js';
import { ListCustomFieldsController } from './list-custom-fields.controller.js';

@Module({
  imports: [ListsModule],
  controllers: [ListCustomFieldsController, CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
