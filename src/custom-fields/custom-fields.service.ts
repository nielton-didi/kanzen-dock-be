import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { FieldDefinitionModel } from '../generated/prisma/models.js';
import { ListsService } from '../lists/lists.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  buildOptions,
  diffCustomFields,
  optionsOf,
  parseCustomFieldFilters,
  validateCustomFieldPatch,
  type CustomFieldPatch,
} from './custom-field-values.js';
import type { CreateFieldDefinitionDto } from './dto/create-field-definition.dto.js';
import type { ReorderFieldDefinitionsDto } from './dto/reorder-field-definitions.dto.js';
import type { UpdateFieldDefinitionDto } from './dto/update-field-definition.dto.js';

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listsService: ListsService,
  ) {}

  async findAllByList(listId: string, userId: string) {
    await this.listsService.verifyAccess(listId, userId);

    return this.getDefinitions(listId);
  }

  async create(listId: string, dto: CreateFieldDefinitionDto, userId: string) {
    await this.listsService.verifyListAdminAccess(listId, userId);

    const name = dto.name.trim();
    const options = buildOptions(dto.kind, dto.options);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.fieldDefinition.findMany({
        where: { list_id: listId },
        select: { name: true },
      });
      if (existing.some((field) => field.name === name)) {
        throw new BadRequestException(
          'A field with this name already exists in this list',
        );
      }

      return tx.fieldDefinition.create({
        data: {
          list_id: listId,
          name,
          kind: dto.kind,
          options,
          position: existing.length,
        },
      });
    });
  }

  async update(fieldId: string, dto: UpdateFieldDefinitionDto, userId: string) {
    const field = await this.findFieldOrThrow(fieldId);
    await this.listsService.verifyListAdminAccess(field.list_id, userId);

    const name = dto.name?.trim();
    if (name && name !== field.name) {
      const duplicate = await this.prisma.fieldDefinition.findFirst({
        where: { list_id: field.list_id, name, NOT: { id: fieldId } },
      });
      if (duplicate) {
        throw new BadRequestException(
          'A field with this name already exists in this list',
        );
      }
    }

    // Removed options leave stale ids in work item values; readers ignore
    // unknown option ids (D2), so there's no rewrite of work items here.
    const options =
      dto.options !== undefined
        ? buildOptions(field.kind, dto.options, optionsOf(field))
        : undefined;

    return this.prisma.fieldDefinition.update({
      where: { id: fieldId },
      data: { name, options },
    });
  }

  async reorder(
    listId: string,
    dto: ReorderFieldDefinitionsDto,
    userId: string,
  ) {
    await this.listsService.verifyListAdminAccess(listId, userId);

    const existing = await this.prisma.fieldDefinition.findMany({
      where: { list_id: listId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((field) => field.id));

    const isValid =
      dto.field_ids.length === existingIds.size &&
      new Set(dto.field_ids).size === dto.field_ids.length &&
      dto.field_ids.every((id) => existingIds.has(id));

    if (!isValid) {
      throw new BadRequestException(
        "Reorder payload must contain exactly this list's current fields",
      );
    }

    // No unique index on position, so a single pass can't collide.
    await this.prisma.$transaction(
      dto.field_ids.map((id, position) =>
        this.prisma.fieldDefinition.update({
          where: { id },
          data: { position },
        }),
      ),
    );

    return this.getDefinitions(listId);
  }

  async remove(fieldId: string, userId: string) {
    const field = await this.findFieldOrThrow(fieldId);
    await this.listsService.verifyListAdminAccess(field.list_id, userId);

    // Strip the key from work items too, so filters and the GIN index never see
    // values for a field that no longer exists. History rows are kept.
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE work_items
        SET custom_fields = custom_fields - ${fieldId}::text, updated_at = now()
        WHERE list_id = ${field.list_id} AND jsonb_exists(custom_fields, ${fieldId}::text)`,
      this.prisma.fieldDefinition.delete({ where: { id: fieldId } }),
    ]);

    return { message: 'Field deleted successfully' };
  }

  /**
   * Validates a work item's `custom_fields` payload against its list's fields.
   * Caller must already have verified access to the list.
   */
  async validatePatch(
    listId: string,
    payload: Record<string, unknown>,
  ): Promise<CustomFieldPatch> {
    const fields = await this.getDefinitions(listId);

    const hasPersonValue = fields.some(
      (field) =>
        field.kind === 'person' &&
        payload[field.id] !== undefined &&
        payload[field.id] !== null,
    );
    const memberIds = hasPersonValue
      ? await this.getWorkspaceMemberIds(listId)
      : new Set<string>();

    return validateCustomFieldPatch(fields, payload, (id) => memberIds.has(id));
  }

  /**
   * Applies a validated patch as a partial merge inside `tx`, and returns the
   * per-key changes for history. The row is locked first so the diffed "old"
   * values are exactly what the merge replaced; the merge itself
   * (`custom_fields || set - unset`) never rewrites keys it doesn't touch, so
   * concurrent edits to different fields both survive.
   */
  async applyPatch(
    tx: Prisma.TransactionClient,
    workItemId: string,
    patch: CustomFieldPatch,
  ) {
    const [row] = await tx.$queryRaw<
      { custom_fields: Record<string, unknown> }[]
    >`
      SELECT custom_fields FROM work_items WHERE id = ${workItemId} FOR UPDATE`;
    if (!row) {
      throw new NotFoundException('Work item not found');
    }

    const changes = diffCustomFields(row.custom_fields, patch);
    if (changes.length === 0) return changes;

    const set = Object.fromEntries(
      changes
        .filter((change) => change.newValue !== null)
        .map((change) => [change.fieldId, change.newValue]),
    );
    const unset = changes
      .filter((change) => change.newValue === null)
      .map((change) => change.fieldId);

    await tx.$executeRaw`
      UPDATE work_items
      SET custom_fields = (custom_fields || ${JSON.stringify(set)}::jsonb) - ${unset}::text[],
          updated_at = now()
      WHERE id = ${workItemId}`;

    return changes;
  }

  /**
   * Ids of the list's work items matching `cf` filters (`<fieldId>:<value>`),
   * via GIN-indexed containment. Same field OR'd, different fields AND'd.
   */
  async findMatchingWorkItemIds(
    listId: string,
    params: string[],
  ): Promise<string[]> {
    const filters = parseCustomFieldFilters(
      await this.getDefinitions(listId),
      params,
    );

    const conditions = filters
      .filter((filter) => filter.contains.length > 0)
      .map((filter) => {
        const anyOf = Prisma.join(
          filter.contains.map(
            (value) =>
              Prisma.sql`custom_fields @> ${JSON.stringify(value)}::jsonb`,
          ),
          ' OR ',
        );
        return filter.negate
          ? Prisma.sql`NOT (${anyOf})`
          : Prisma.sql`(${anyOf})`;
      });

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM work_items
      WHERE list_id = ${listId}
      ${conditions.length ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}` : Prisma.empty}`;

    return rows.map((row) => row.id);
  }

  private getDefinitions(listId: string) {
    return this.prisma.fieldDefinition.findMany({
      where: { list_id: listId },
      orderBy: { position: 'asc' },
    });
  }

  private async getWorkspaceMemberIds(listId: string): Promise<Set<string>> {
    const list = await this.prisma.list.findUnique({
      where: { id: listId },
      select: {
        project: {
          select: {
            workspace: {
              select: {
                owner_id: true,
                members: { select: { user_id: true } },
              },
            },
          },
        },
      },
    });
    const workspace = list?.project.workspace;
    if (!workspace) return new Set();

    return new Set([
      workspace.owner_id,
      ...workspace.members.map((m) => m.user_id),
    ]);
  }

  private async findFieldOrThrow(
    fieldId: string,
  ): Promise<FieldDefinitionModel> {
    const field = await this.prisma.fieldDefinition.findUnique({
      where: { id: fieldId },
    });
    if (!field) {
      throw new NotFoundException('Field not found');
    }
    return field;
  }
}
