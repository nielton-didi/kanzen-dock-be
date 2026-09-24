import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  STATUS_COLORS,
  type StatusColor,
} from '../statuses/dto/update-status.dto.js';
import { DATE_ONLY_PATTERN } from '../work-items/work-item-fields.const.js';

// The one place custom field definitions and values are validated (D2): the DB
// can't type-check inside JSONB, so everything that reads or writes
// `WorkItem.custom_fields` goes through here.

export const FIELD_KINDS = [
  'text',
  'number',
  'dropdown',
  'multi_select',
  'date',
  'person',
  'checkbox',
  'url',
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** Kinds whose values are option ids from `FieldDefinition.options`. */
const OPTION_KINDS: readonly FieldKind[] = ['dropdown', 'multi_select'];

/** Kinds filterable by equality via the GIN-indexed `@>` containment query. */
const FILTERABLE_KINDS: readonly FieldKind[] = [
  'dropdown',
  'multi_select',
  'person',
  'checkbox',
];

export const MAX_OPTIONS = 200;
export const MAX_TEXT_LENGTH = 10_000;
const MAX_URL_LENGTH = 2048;

export type FieldOption = { id: string; label: string; color: StatusColor };

/** The subset of a FieldDefinition row this module needs. */
export type FieldDefinitionLike = {
  id: string;
  kind: string;
  options: unknown;
};

export type OptionInput = { id?: string; label: string; color?: StatusColor };

/** A JSON value stored under a field id. `null` is never stored — it means "unset". */
export type FieldValue = string | number | boolean | string[];

export function isOptionKind(kind: string): boolean {
  return OPTION_KINDS.includes(kind as FieldKind);
}

export function optionsOf(field: FieldDefinitionLike): FieldOption[] {
  return Array.isArray(field.options) ? (field.options as FieldOption[]) : [];
}

/**
 * Normalizes a create/update options payload into stored options. Options
 * that carry an `id` must already exist on the field (so renaming keeps the
 * id and work item values stay valid); options without one get a new id.
 * Order in the payload is the display order.
 */
export function buildOptions(
  kind: string,
  input: OptionInput[] | undefined,
  existing: FieldOption[] = [],
): FieldOption[] {
  if (!isOptionKind(kind)) {
    if (input?.length) {
      throw new BadRequestException(`A ${kind} field cannot have options`);
    }
    return [];
  }

  const options = input ?? [];
  if (options.length > MAX_OPTIONS) {
    throw new BadRequestException(
      `A field can have at most ${MAX_OPTIONS} options`,
    );
  }

  const existingById = new Map(existing.map((option) => [option.id, option]));
  const labels = new Set<string>();
  const ids = new Set<string>();

  return options.map((option, index) => {
    const label = option.label.trim();
    if (!label) {
      throw new BadRequestException('Option labels must not be empty');
    }
    if (labels.has(label)) {
      throw new BadRequestException(`Duplicate option label "${label}"`);
    }
    labels.add(label);

    if (option.id !== undefined) {
      const current = existingById.get(option.id);
      if (!current) {
        throw new BadRequestException(`Unknown option id "${option.id}"`);
      }
      if (ids.has(option.id)) {
        throw new BadRequestException(`Duplicate option id "${option.id}"`);
      }
      ids.add(option.id);
      return { id: option.id, label, color: option.color ?? current.color };
    }

    return {
      id: randomUUID(),
      label,
      color: option.color ?? STATUS_COLORS[index % STATUS_COLORS.length],
    };
  });
}

/** Validated patch, split into keys to merge (`custom_fields || set`) and keys to remove (`- unset`). */
export type CustomFieldPatch = {
  set: Record<string, FieldValue>;
  unset: string[];
};

/**
 * Validates a `custom_fields` payload against the list's field definitions.
 * `null` (and empty values: `""`, `[]`, `false`) unsets a field, so "unset"
 * has exactly one stored representation: the key is absent.
 *
 * `isMember` checks a person value belongs to the list's workspace.
 */
export function validateCustomFieldPatch(
  fields: FieldDefinitionLike[],
  payload: Record<string, unknown>,
  isMember: (userId: string) => boolean,
): CustomFieldPatch {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const patch: CustomFieldPatch = { set: {}, unset: [] };

  for (const [fieldId, raw] of Object.entries(payload)) {
    const field = fieldsById.get(fieldId);
    if (!field) {
      throw new BadRequestException(`Unknown custom field "${fieldId}"`);
    }

    const value = validateValue(field, raw, isMember);
    if (value === null) {
      patch.unset.push(fieldId);
    } else {
      patch.set[fieldId] = value;
    }
  }

  return patch;
}

function validateValue(
  field: FieldDefinitionLike,
  raw: unknown,
  isMember: (userId: string) => boolean,
): FieldValue | null {
  if (raw === null) return null;

  const invalid = (expected: string) =>
    new BadRequestException(
      `Custom field "${field.id}" (${field.kind}) expects ${expected}`,
    );

  switch (field.kind as FieldKind) {
    case 'text': {
      if (typeof raw !== 'string') throw invalid('a string');
      if (raw.length > MAX_TEXT_LENGTH) {
        throw invalid(`at most ${MAX_TEXT_LENGTH} characters`);
      }
      return raw === '' ? null : raw;
    }

    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw))
        throw invalid('a finite number');
      return raw;
    }

    case 'checkbox': {
      if (typeof raw !== 'boolean') throw invalid('a boolean');
      return raw ? true : null;
    }

    case 'date': {
      if (typeof raw !== 'string' || !isCalendarDay(raw))
        throw invalid('a YYYY-MM-DD date');
      return raw;
    }

    case 'url': {
      if (typeof raw !== 'string') throw invalid('a URL string');
      if (raw === '') return null;
      if (raw.length > MAX_URL_LENGTH || !isHttpUrl(raw))
        throw invalid('an http(s) URL');
      return raw;
    }

    case 'person': {
      if (typeof raw !== 'string' || !isMember(raw)) {
        throw invalid('the id of a workspace member');
      }
      return raw;
    }

    case 'dropdown': {
      const optionIds = new Set(optionsOf(field).map((option) => option.id));
      if (typeof raw !== 'string' || !optionIds.has(raw)) {
        throw invalid('one of its option ids');
      }
      return raw;
    }

    case 'multi_select': {
      const optionIds = new Set(optionsOf(field).map((option) => option.id));
      if (
        !Array.isArray(raw) ||
        !raw.every((id) => typeof id === 'string' && optionIds.has(id))
      ) {
        throw invalid('an array of its option ids');
      }
      const unique = [...new Set(raw as string[])];
      return unique.length ? unique : null;
    }

    default:
      throw new BadRequestException(
        `Custom field "${field.id}" has unknown kind "${field.kind}"`,
      );
  }
}

/** Parsed `?cf=<fieldId>:<value>` filters: same field OR'd, different fields AND'd. */
export type CustomFieldFilter = {
  fieldId: string;
  /** Containment objects, one per value; a row matches the field if it contains any. */
  contains: Record<string, FieldValue>[];
  /** Checkbox "false" matches rows that do NOT contain `true`. */
  negate: boolean;
};

/**
 * Parses `cf` query values (`<fieldId>:<value>`) into containment filters.
 * Only equality-style kinds are filterable for now (dropdown, multi_select,
 * person, checkbox); ranges on number/date need a non-GIN query.
 */
export function parseCustomFieldFilters(
  fields: FieldDefinitionLike[],
  params: string[],
): CustomFieldFilter[] {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const valuesByField = new Map<string, string[]>();

  for (const param of params) {
    const separator = param.indexOf(':');
    const fieldId = separator > 0 ? param.slice(0, separator) : '';
    const value = separator > 0 ? param.slice(separator + 1) : '';
    if (!fieldId || !value) {
      throw new BadRequestException(
        'cf filters must look like <fieldId>:<value>',
      );
    }

    const field = fieldsById.get(fieldId);
    if (!field) {
      throw new BadRequestException(`Unknown custom field "${fieldId}"`);
    }
    if (!FILTERABLE_KINDS.includes(field.kind as FieldKind)) {
      throw new BadRequestException(
        `Filtering by a ${field.kind} field is not supported`,
      );
    }

    valuesByField.set(fieldId, [...(valuesByField.get(fieldId) ?? []), value]);
  }

  return [...valuesByField].map(([fieldId, values]) => {
    const field = fieldsById.get(fieldId)!;

    if (field.kind === 'checkbox') {
      const wanted = new Set(
        values.map((value) => {
          if (value !== 'true' && value !== 'false') {
            throw new BadRequestException(
              'Checkbox filters take true or false',
            );
          }
          return value === 'true';
        }),
      );
      // Both true and false selected: no constraint at all.
      if (wanted.size === 2) return { fieldId, contains: [], negate: false };
      return {
        fieldId,
        contains: [{ [fieldId]: true }],
        negate: !wanted.has(true),
      };
    }

    return {
      fieldId,
      contains: values.map((value) => ({
        [fieldId]: field.kind === 'multi_select' ? [value] : value,
      })),
      negate: false,
    };
  });
}

/** Keys whose stored value differs between `before` and the value after applying `patch`. */
export function diffCustomFields(
  before: Record<string, unknown>,
  patch: CustomFieldPatch,
): {
  fieldId: string;
  oldValue: FieldValue | null;
  newValue: FieldValue | null;
}[] {
  const changes: ReturnType<typeof diffCustomFields> = [];

  for (const [fieldId, newValue] of Object.entries(patch.set)) {
    const oldValue = (before[fieldId] ?? null) as FieldValue | null;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ fieldId, oldValue, newValue });
    }
  }
  for (const fieldId of patch.unset) {
    if (fieldId in before) {
      changes.push({
        fieldId,
        oldValue: before[fieldId] as FieldValue,
        newValue: null,
      });
    }
  }

  return changes;
}

/** History `field_name` for a custom field change. */
export function customFieldHistoryName(fieldId: string): string {
  return `cf:${fieldId}`;
}

function isCalendarDay(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
