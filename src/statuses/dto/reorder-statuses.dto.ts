import { IsArray, IsString } from 'class-validator';

/** Grouped, ordered status ids per category — drives both same-category reorder and cross-category moves. */
export class ReorderStatusesDto {
  @IsArray()
  @IsString({ each: true })
  not_started!: string[];

  @IsArray()
  @IsString({ each: true })
  active!: string[];

  @IsArray()
  @IsString({ each: true })
  done!: string[];

  @IsArray()
  @IsString({ each: true })
  closed!: string[];
}
