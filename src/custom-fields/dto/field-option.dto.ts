import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  STATUS_COLORS,
  type StatusColor,
} from '../../statuses/dto/update-status.dto.js';

/** A dropdown / multi-select option. Omit `id` for a new option; keep it to rename/recolor an existing one. */
export class FieldOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label!: string;

  @IsOptional()
  @IsIn(STATUS_COLORS)
  color?: StatusColor;
}
