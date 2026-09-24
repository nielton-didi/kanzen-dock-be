import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_OPTIONS } from '../custom-field-values.js';
import { FieldOptionDto } from './field-option.dto.js';

/** `kind` is fixed after creation — changing it would invalidate stored values. */
export class UpdateFieldDefinitionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  /** Replaces the full option list, in display order. Options left out are removed. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_OPTIONS)
  @ValidateNested({ each: true })
  @Type(() => FieldOptionDto)
  options?: FieldOptionDto[];
}
