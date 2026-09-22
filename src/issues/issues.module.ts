import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module.js';
import { StatusesModule } from '../statuses/statuses.module.js';
import { IssueHistoryService } from './issue-history.service.js';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';
import { ListIssuesController } from './list-issues.controller.js';

@Module({
  imports: [ListsModule, StatusesModule],
  controllers: [ListIssuesController, IssuesController],
  providers: [IssuesService, IssueHistoryService],
  exports: [IssuesService],
})
export class IssuesModule {}
