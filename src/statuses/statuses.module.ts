import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module.js';
import { ListStatusesController } from './list-statuses.controller.js';
import { StatusesController } from './statuses.controller.js';
import { StatusesService } from './statuses.service.js';

@Module({
  imports: [ListsModule],
  controllers: [ListStatusesController, StatusesController],
  providers: [StatusesService],
  exports: [StatusesService],
})
export class StatusesModule {}
