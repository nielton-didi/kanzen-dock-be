import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { UserModel } from '../generated/prisma/models.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { FindIssuesQueryDto } from './dto/find-issues-query.dto.js';
import { IssuesService } from './issues.service.js';

@Controller('lists/:listId/issues')
export class ListIssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  create(
    @Param('listId') listId: string,
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.issuesService.create(listId, dto, user.id);
  }

  @Get()
  findAll(
    @Param('listId') listId: string,
    @Query() query: FindIssuesQueryDto,
    @CurrentUser() user: UserModel,
  ) {
    return this.issuesService.findAllByList(listId, user.id, query);
  }
}
