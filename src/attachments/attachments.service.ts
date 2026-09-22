import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IssuesService } from '../issues/issues.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class AttachmentsService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly issuesService: IssuesService,
    configService: ConfigService,
  ) {
    this.bucket = configService.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

  async uploadAttachment(
    issueId: string,
    file: Express.Multer.File,
    userId: string,
  ) {
    await this.issuesService.verifyAccess(issueId, userId);

    const storagePath = `issues/${issueId}/${Date.now()}-${file.originalname}`;

    const { error } = await this.supabase.adminClient.storage
      .from(this.bucket)
      .upload(storagePath, file.buffer, { contentType: file.mimetype });

    if (error) {
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.supabase.adminClient.storage
      .from(this.bucket)
      .getPublicUrl(storagePath);

    return this.prisma.attachment.create({
      data: {
        issue_id: issueId,
        file_url: publicUrl,
        file_name: file.originalname,
        file_size: file.size,
        file_type: file.mimetype,
        uploaded_by: userId,
      },
      include: { uploader: true },
    });
  }

  async getIssueAttachments(issueId: string, userId: string) {
    await this.issuesService.verifyAccess(issueId, userId);

    return this.prisma.attachment.findMany({
      where: { issue_id: issueId },
      include: { uploader: true },
      orderBy: { uploaded_at: 'desc' },
    });
  }

  async deleteAttachment(attachmentId: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.issuesService.verifyAccess(attachment.issue_id, userId);

    const storagePath = this.extractStoragePath(attachment.file_url);
    if (storagePath) {
      await this.supabase.adminClient.storage
        .from(this.bucket)
        .remove([storagePath]);
    }

    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    return { message: 'Attachment deleted successfully' };
  }

  private extractStoragePath(publicUrl: string): string | null {
    const marker = `/object/public/${this.bucket}/`;
    const index = publicUrl.indexOf(marker);
    return index === -1 ? null : publicUrl.slice(index + marker.length);
  }
}
