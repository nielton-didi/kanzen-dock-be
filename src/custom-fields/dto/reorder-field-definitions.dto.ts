import { IsArray, IsString } from 'class-validator';

/** Every field id of the list, in the new display order. */
export class ReorderFieldDefinitionsDto {
  @IsArray()
  @IsString({ each: true })
  field_ids!: string[];
}
