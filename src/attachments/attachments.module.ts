import { Module } from '@nestjs/common';
import { IssuesModule } from '../issues/issues.module.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { IssueAttachmentsController } from './issue-attachments.controller.js';

@Module({
  imports: [IssuesModule],
  controllers: [IssueAttachmentsController, AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
