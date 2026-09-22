import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Fixed palette — keep in sync with the frontend's status color tokens (app/globals.css). */
export const STATUS_COLORS = [
  'gray',
  'blue',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
  'red',
  'magenta',
  'purple',
] as const;

export type StatusColor = (typeof STATUS_COLORS)[number];

export class UpdateStatusDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(STATUS_COLORS)
  color?: StatusColor;
}
