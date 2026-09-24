import { BadRequestException, Injectable } from '@nestjs/common';
import { ListsService } from '../lists/lists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateListPreferenceDto } from './dto/update-list-preference.dto.js';

/** Custom fields a user can show as columns in one list's rows. */
export const MAX_ROW_FIELDS = 3;

export type ListPreference = { list_id: string; row_field_ids: string[] };

/**
 * Personal view settings per (user, list) — D6. Any user with access to the
 * list manages their own; nobody else's is readable or writable.
 */
@Injectable()
export class ListPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listsService: ListsService,
  ) {}

  async findMine(listId: string, userId: string): Promise<ListPreference> {
    await this.listsService.verifyAccess(listId, userId);

    const [preference, activeIds] = await Promise.all([
      this.prisma.listUserPreference.findUnique({
        where: { list_id_user_id: { list_id: listId, user_id: userId } },
      }),
      this.activeFieldIds(listId),
    ]);

    // Ids of fields deleted since are kept in storage (a restore brings the
    // column back) but never returned.
    return {
      list_id: listId,
      row_field_ids: (preference?.row_field_ids ?? []).filter((id) =>
        activeIds.has(id),
      ),
    };
  }

  async updateMine(
    listId: string,
    dto: UpdateListPreferenceDto,
    userId: string,
  ): Promise<ListPreference> {
    await this.listsService.verifyAccess(listId, userId);

    const activeIds = await this.activeFieldIds(listId);
    const unknown = dto.row_field_ids.find((id) => !activeIds.has(id));
    if (unknown !== undefined) {
      throw new BadRequestException(`Unknown custom field "${unknown}"`);
    }

    const preference = await this.prisma.listUserPreference.upsert({
      where: { list_id_user_id: { list_id: listId, user_id: userId } },
      create: {
        list_id: listId,
        user_id: userId,
        row_field_ids: dto.row_field_ids,
      },
      update: { row_field_ids: dto.row_field_ids },
    });

    return { list_id: listId, row_field_ids: preference.row_field_ids };
  }

  private async activeFieldIds(listId: string): Promise<Set<string>> {
    const fields = await this.prisma.fieldDefinition.findMany({
      where: { list_id: listId, deleted_at: null },
      select: { id: true },
    });
    return new Set(fields.map((field) => field.id));
  }
}
