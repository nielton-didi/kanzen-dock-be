import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { IssueHistoryService } from './issue-history.service.js';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';
import { ProjectIssuesController } from './project-issues.controller.js';

@Module({
  imports: [ProjectsModule],
  controllers: [ProjectIssuesController, IssuesController],
  providers: [IssuesService, IssueHistoryService],
  exports: [IssuesService],
})
export class IssuesModule {}
