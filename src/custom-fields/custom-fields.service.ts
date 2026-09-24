import {
  BadRequestException,
  ConflictException,
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

const NAME_TAKEN_MESSAGE = 'A field with this name already exists in this list';

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listsService: ListsService,
  ) {}

  /** Active fields in display order, or with `deleted` the soft-deleted ones (most recently deleted first). */
  async findAllByList(listId: string, userId: string, deleted = false) {
    await this.listsService.verifyAccess(listId, userId);

    if (deleted) {
      return this.prisma.fieldDefinition.findMany({
        where: { list_id: listId, deleted_at: { not: null } },
        orderBy: { deleted_at: 'desc' },
      });
    }
    return this.getDefinitions(listId);
  }

  async create(listId: string, dto: CreateFieldDefinitionDto, userId: string) {
    await this.listsService.verifyListAdminAccess(listId, userId);

    const name = dto.name.trim();
    const options = buildOptions(dto.kind, dto.options);

    // Checked here for a clear message; the partial unique index on active
    // (list_id, name) catches concurrent creates.
    await this.assertNameAvailable(listId, name, BadRequestException);

    return this.withNameConflict(BadRequestException, async () =>
      this.prisma.fieldDefinition.create({
        data: {
          list_id: listId,
          name,
          kind: dto.kind,
          options,
          position: await this.nextPosition(listId),
        },
      }),
    );
  }

  async update(fieldId: string, dto: UpdateFieldDefinitionDto, userId: string) {
    const field = await this.findFieldOrThrow(fieldId);
    await this.listsService.verifyListAdminAccess(field.list_id, userId);

    const name = dto.name?.trim();
    if (name && name !== field.name) {
      await this.assertNameAvailable(field.list_id, name, BadRequestException);
    }

    // Removed options leave stale ids in work item values; readers ignore
    // unknown option ids (D2), so there's no rewrite of work items here.
    const options =
      dto.options !== undefined
        ? buildOptions(field.kind, dto.options, optionsOf(field))
        : undefined;

    return this.withNameConflict(BadRequestException, () =>
      this.prisma.fieldDefinition.update({
        where: { id: fieldId },
        data: { name, options },
      }),
    );
  }

  async reorder(
    listId: string,
    dto: ReorderFieldDefinitionsDto,
    userId: string,
  ) {
    await this.listsService.verifyListAdminAccess(listId, userId);

    const existing = await this.prisma.fieldDefinition.findMany({
      where: { list_id: listId, deleted_at: null },
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

    // Soft delete (D2): values stay in work items' custom_fields so a restore
    // brings them back. Until then the field is unknown to writes and filters,
    // and readers ignore its key. Permanent purge comes with CORE-20.
    await this.prisma.fieldDefinition.update({
      where: { id: fieldId },
      data: { deleted_at: new Date() },
    });

    return { message: 'Field deleted successfully' };
  }

  /** Brings back a soft-deleted field, with its values, at the end of the list's fields. */
  async restore(fieldId: string, userId: string) {
    const field = await this.prisma.fieldDefinition.findUnique({
      where: { id: fieldId },
    });
    if (!field || field.deleted_at === null) {
      throw new NotFoundException('Deleted field not found');
    }
    await this.listsService.verifyListAdminAccess(field.list_id, userId);

    await this.assertNameAvailable(
      field.list_id,
      field.name,
      ConflictException,
    );

    return this.withNameConflict(ConflictException, async () =>
      this.prisma.fieldDefinition.update({
        where: { id: fieldId },
        data: {
          deleted_at: null,
          position: await this.nextPosition(field.list_id),
        },
      }),
    );
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

  /** The list's active fields. Everything else treats deleted fields as unknown. */
  private getDefinitions(listId: string) {
    return this.prisma.fieldDefinition.findMany({
      where: { list_id: listId, deleted_at: null },
      orderBy: { position: 'asc' },
    });
  }

  private async nextPosition(listId: string): Promise<number> {
    const { _max } = await this.prisma.fieldDefinition.aggregate({
      where: { list_id: listId, deleted_at: null },
      _max: { position: true },
    });
    return (_max.position ?? -1) + 1;
  }

  /** Names are unique among a list's active fields; a deleted field's name is free. */
  private async assertNameAvailable(
    listId: string,
    name: string,
    Exception: typeof BadRequestException | typeof ConflictException,
  ) {
    const duplicate = await this.prisma.fieldDefinition.findFirst({
      where: { list_id: listId, name, deleted_at: null },
      select: { id: true },
    });
    if (duplicate) {
      throw new Exception(NAME_TAKEN_MESSAGE);
    }
  }

  /** Maps a lost race on the partial unique index (active list_id + name) to `Exception`. */
  private async withNameConflict<T>(
    Exception: typeof BadRequestException | typeof ConflictException,
    write: () => Promise<T>,
  ): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Exception(NAME_TAKEN_MESSAGE);
      }
      throw error;
    }
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

  /** An active field; a deleted one is not found until it's restored. */
  private async findFieldOrThrow(
    fieldId: string,
  ): Promise<FieldDefinitionModel> {
    const field = await this.prisma.fieldDefinition.findUnique({
      where: { id: fieldId },
    });
    if (!field || field.deleted_at !== null) {
      throw new NotFoundException('Field not found');
    }
    return field;
  }
}
