import { Controller, Delete, Param } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { AttachmentsService } from './attachments.service.js';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Delete(':attachmentId')
  remove(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.attachmentsService.deleteAttachment(attachmentId, user.id);
  }
}
