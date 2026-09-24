import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  FIELD_KINDS,
  MAX_OPTIONS,
  type FieldKind,
} from '../custom-field-values.js';
import { FieldOptionDto } from './field-option.dto.js';

export class CreateFieldDefinitionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsIn(FIELD_KINDS)
  kind!: FieldKind;

  /** Only for dropdown / multi_select — rejected for other kinds in custom-field-values.ts. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => FieldOptionDto)
  options?: FieldOptionDto[];
}
