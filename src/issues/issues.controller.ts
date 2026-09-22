import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { UpdateIssueDto } from './dto/update-issue.dto.js';
import { IssuesService } from './issues.service.js';

@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Get(':issueId')
  findOne(@Param('issueId') issueId: string, @CurrentUser() user: UserModel) {
    return this.issuesService.findOne(issueId, user.id);
  }

  @Put(':issueId')
  update(
    @Param('issueId') issueId: string,
    @Body() dto: UpdateIssueDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.issuesService.update(issueId, dto, user.id);
  }

  @Get(':issueId/history')
  getHistory(
    @Param('issueId') issueId: string,
    @CurrentUser() user: UserModel,
  ) {
    return this.issuesService.getHistory(issueId, user.id);
  }

  @Delete(':issueId')
  remove(@Param('issueId') issueId: string, @CurrentUser() user: UserModel) {
    return this.issuesService.remove(issueId, user.id);
  }
}
