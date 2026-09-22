import { Injectable, NotFoundException } from '@nestjs/common';
import type { IssueModel } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { CreateIssueDto } from './dto/create-issue.dto.js';
import type { FindIssuesQueryDto } from './dto/find-issues-query.dto.js';
import type { UpdateIssueDto } from './dto/update-issue.dto.js';
import { IssueHistoryService } from './issue-history.service.js';

const ISSUE_INCLUDE = {
  assignee: true,
  reporter: true,
  attachments: true,
} as const;

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly issueHistory: IssueHistoryService,
  ) {}

  /** Verifies the user has access to the issue (via its project's workspace) and returns it. */
  async verifyAccess(issueId: string, userId: string): Promise<IssueModel> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    await this.projectsService.verifyAccess(issue.project_id, userId);

    return issue;
  }

  async create(projectId: string, dto: CreateIssueDto, userId: string) {
    await this.projectsService.verifyAccess(projectId, userId);

    const issue = await this.prisma.issue.create({
      data: {
        title: dto.title,
        description: dto.description,
        project_id: projectId,
        severity: dto.severity,
        priority: dto.priority,
        reported_by: userId,
      },
      include: ISSUE_INCLUDE,
    });

    await this.issueHistory.logChange(
      issue.id,
      'created',
      null,
      JSON.stringify({ title: issue.title, description: issue.description }),
      userId,
    );

    return issue;
  }

  async findAllByProject(
    projectId: string,
    userId: string,
    filters: FindIssuesQueryDto,
  ) {
    await this.projectsService.verifyAccess(projectId, userId);

    return this.prisma.issue.findMany({
      where: {
        project_id: projectId,
        status: filters.status,
        severity: filters.severity,
        priority: filters.priority,
        assigned_to: filters.assigned_to,
      },
      include: ISSUE_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(issueId: string, userId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        ...ISSUE_INCLUDE,
        project: { include: { workspace: true } },
        history: {
          include: { changer: true },
          orderBy: { changed_at: 'desc' },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    await this.projectsService.verifyAccess(issue.project_id, userId);

    return issue;
  }

  async update(issueId: string, dto: UpdateIssueDto, userId: string) {
    const issue = await this.verifyAccess(issueId, userId);

    const fieldsToUpdate: Record<string, string | null> = {};

    const trackableFields = [
      'title',
      'description',
      'status',
      'priority',
      'severity',
      'assigned_to',
    ] as const;

    for (const field of trackableFields) {
      const newValue = dto[field];
      if (newValue !== undefined && newValue !== issue[field]) {
        await this.issueHistory.logChange(
          issueId,
          field,
          issue[field],
          newValue,
          userId,
        );
        fieldsToUpdate[field] = newValue;
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return this.prisma.issue.findUnique({
        where: { id: issueId },
        include: ISSUE_INCLUDE,
      });
    }

    return this.prisma.issue.update({
      where: { id: issueId },
      data: fieldsToUpdate,
      include: ISSUE_INCLUDE,
    });
  }

  async getHistory(issueId: string, userId: string) {
    await this.verifyAccess(issueId, userId);

    return this.issueHistory.getIssueHistory(issueId);
  }
}
