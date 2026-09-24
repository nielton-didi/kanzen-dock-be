import { Module } from '@nestjs/common';
import { WorkItemsModule } from '../work-items/work-items.module.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { WorkItemAttachmentsController } from './work-item-attachments.controller.js';

@Module({
  imports: [WorkItemsModule],
  controllers: [WorkItemAttachmentsController, AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
