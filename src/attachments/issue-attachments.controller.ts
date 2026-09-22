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

@Controller('issues/:issueId/attachments')
export class IssueAttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  upload(
    @Param('issueId') issueId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserModel,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.attachmentsService.uploadAttachment(issueId, file, user.id);
  }

  @Get()
  findAll(@Param('issueId') issueId: string, @CurrentUser() user: UserModel) {
    return this.attachmentsService.getIssueAttachments(issueId, user.id);
  }
}
