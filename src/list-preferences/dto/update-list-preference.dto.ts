import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';
import { MAX_ROW_FIELDS } from '../list-preferences.service.js';

export class UpdateListPreferenceDto {
  /** Active custom field ids of the list, in column order. `[]` shows none. */
  @IsArray()
  @ArrayMaxSize(MAX_ROW_FIELDS)
  @ArrayUnique()
  @IsString({ each: true })
  row_field_ids!: string[];
}
