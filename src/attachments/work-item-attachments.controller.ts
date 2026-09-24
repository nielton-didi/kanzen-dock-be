import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { AttachmentsService } from './attachments.service.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Controller('work-items/:workItemId/attachments')
export class WorkItemAttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  upload(
    @Param('workItemId') workItemId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserModel,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.attachmentsService.uploadAttachment(workItemId, file, user.id);
  }

  @Get()
  findAll(@Param('workItemId') workItemId: string, @CurrentUser() user: UserModel) {
    return this.attachmentsService.getWorkItemAttachments(workItemId, user.id);
  }
}
