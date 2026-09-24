import { Module } from '@nestjs/common';
import { ListsModule } from '../lists/lists.module.js';
import { ListPreferencesController } from './list-preferences.controller.js';
import { ListPreferencesService } from './list-preferences.service.js';

@Module({
  imports: [ListsModule],
  controllers: [ListPreferencesController],
  providers: [ListPreferencesService],
})
export class ListPreferencesModule {}
