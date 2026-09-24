import { Controller, Get } from '@nestjs/common';
import { LIST_TEMPLATES } from './list-templates.const.js';

@Controller('list-templates')
export class ListTemplatesController {
  /** The templates offered when creating a list (D3). */
  @Get()
  findAll() {
    return LIST_TEMPLATES;
  }
}
