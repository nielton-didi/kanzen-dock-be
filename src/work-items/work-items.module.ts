import { Module } from '@nestjs/common';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module.js';
import { ListsModule } from '../lists/lists.module.js';
import { StatusesModule } from '../statuses/statuses.module.js';
import { WorkItemHistoryService } from './work-item-history.service.js';
import { WorkItemsController } from './work-items.controller.js';
import { WorkItemsService } from './work-items.service.js';
import { ListWorkItemsController } from './list-work-items.controller.js';

@Module({
  imports: [ListsModule, StatusesModule, CustomFieldsModule],
  controllers: [ListWorkItemsController, WorkItemsController],
  providers: [WorkItemsService, WorkItemHistoryService],
  exports: [WorkItemsService],
})
export class WorkItemsModule {}
