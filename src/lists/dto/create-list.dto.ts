import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LIST_TEMPLATE_KEYS } from '../list-templates.const.js';

export class CreateListDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  /** Template whose statuses and fields are copied into the list. Defaults to `general-tasks`. */
  @IsOptional()
  @IsIn(LIST_TEMPLATE_KEYS)
  template_key?: string;
}
