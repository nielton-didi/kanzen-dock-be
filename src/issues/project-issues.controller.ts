import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { FindIssuesQueryDto } from './dto/find-issues-query.dto.js';
import { IssuesService } from './issues.service.js';

@Controller('projects/:projectId/issues')
export class ProjectIssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.issuesService.create(projectId, dto, user.id);
  }

  @Get()
  findAll(
    @Param('projectId') projectId: string,
    @Query() query: FindIssuesQueryDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.issuesService.findAllByProject(projectId, user.id, query);
  }
}
