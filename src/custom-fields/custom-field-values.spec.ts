import { BadRequestException } from '@nestjs/common';
import {
  buildOptions,
  diffCustomFields,
  parseCustomFieldFilters,
  validateCustomFieldPatch,
  type FieldDefinitionLike,
} from './custom-field-values.js';

const options = [
  { id: 'o1', label: 'Low', color: 'gray' },
  { id: 'o2', label: 'High', color: 'red' },
];

const fields: FieldDefinitionLike[] = [
  { id: 'text', kind: 'text', options: [] },
  { id: 'num', kind: 'number', options: [] },
  { id: 'drop', kind: 'dropdown', options },
  { id: 'multi', kind: 'multi_select', options },
  { id: 'date', kind: 'date', options: [] },
  { id: 'person', kind: 'person', options: [] },
  { id: 'check', kind: 'checkbox', options: [] },
  { id: 'url', kind: 'url', options: [] },
];

const isMember = (id: string) => id === 'u1';
const validate = (payload: Record<string, unknown>) =>
  validateCustomFieldPatch(fields, payload, isMember);

describe('validateCustomFieldPatch', () => {
  it('accepts a valid value for every kind', () => {
    expect(
      validate({
        text: 'hello',
        num: 0,
        drop: 'o1',
        multi: ['o2', 'o1', 'o2'],
        date: '2026-02-28',
        person: 'u1',
        check: true,
        url: 'https://example.com/a',
      }),
    ).toEqual({
      set: {
        text: 'hello',
        num: 0,
        drop: 'o1',
        multi: ['o2', 'o1'],
        date: '2026-02-28',
        person: 'u1',
        check: true,
        url: 'https://example.com/a',
      },
      unset: [],
    });
  });

  it('treats null and empty values as unset', () => {
    expect(
      validate({
        text: '',
        num: null,
        multi: [],
        check: false,
        url: '',
        drop: null,
      }),
    ).toEqual({
      set: {},
      unset: ['text', 'num', 'multi', 'check', 'url', 'drop'],
    });
  });

  it.each([
    ['unknown field', { nope: 'x' }],
    ['text not a string', { text: 5 }],
    ['number as string', { num: '5' }],
    ['non-finite number', { num: Number.POSITIVE_INFINITY }],
    ['unknown dropdown option', { drop: 'o9' }],
    ['dropdown given a label', { drop: 'Low' }],
    ['multi_select not an array', { multi: 'o1' }],
    ['multi_select unknown option', { multi: ['o1', 'o9'] }],
    ['impossible date', { date: '2026-02-30' }],
    ['date with time', { date: '2026-02-28T00:00:00Z' }],
    ['non-member person', { person: 'u2' }],
    ['checkbox as string', { check: 'true' }],
    ['non-http url', { url: 'javascript:alert(1)' }],
    ['malformed url', { url: 'not a url' }],
  ])('rejects %s', (_, payload) => {
    expect(() => validate(payload)).toThrow(BadRequestException);
  });
});

describe('buildOptions', () => {
  it('assigns ids and colors to new options', () => {
    const built = buildOptions('dropdown', [
      { label: ' A ' },
      { label: 'B', color: 'red' },
    ]);
    expect(built).toHaveLength(2);
    expect(built[0]).toMatchObject({ label: 'A', color: 'gray' });
    expect(built[1]).toMatchObject({ label: 'B', color: 'red' });
    expect(built[0].id).not.toEqual(built[1].id);
  });

  it('keeps ids and colors of existing options on rename', () => {
    expect(
      buildOptions(
        'dropdown',
        [{ id: 'o2', label: 'Very high' }],
        options as never,
      ),
    ).toEqual([{ id: 'o2', label: 'Very high', color: 'red' }]);
  });

  it('rejects unknown ids, duplicate labels, and options on other kinds', () => {
    expect(() =>
      buildOptions('dropdown', [{ id: 'o9', label: 'X' }], options as never),
    ).toThrow(BadRequestException);
    expect(() =>
      buildOptions('dropdown', [{ label: 'X' }, { label: 'X' }]),
    ).toThrow(BadRequestException);
    expect(() => buildOptions('text', [{ label: 'X' }])).toThrow(
      BadRequestException,
    );
    expect(buildOptions('text', undefined)).toEqual([]);
  });
});

describe('diffCustomFields', () => {
  it('reports only keys whose value changes', () => {
    const before = { drop: 'o1', multi: ['o1'], text: 'same' };
    expect(
      diffCustomFields(before, {
        set: { drop: 'o2', multi: ['o1'], text: 'same', num: 3 },
        unset: ['text', 'check'],
      }),
    ).toEqual([
      { fieldId: 'drop', oldValue: 'o1', newValue: 'o2' },
      { fieldId: 'num', oldValue: null, newValue: 3 },
      { fieldId: 'text', oldValue: 'same', newValue: null },
    ]);
  });
});

describe('parseCustomFieldFilters', () => {
  it('groups values per field and wraps multi_select values in arrays', () => {
    expect(
      parseCustomFieldFilters(fields, [
        'drop:o1',
        'multi:o2',
        'drop:o2',
        'person:u1',
      ]),
    ).toEqual([
      {
        fieldId: 'drop',
        contains: [{ drop: 'o1' }, { drop: 'o2' }],
        negate: false,
      },
      { fieldId: 'multi', contains: [{ multi: ['o2'] }], negate: false },
      { fieldId: 'person', contains: [{ person: 'u1' }], negate: false },
    ]);
  });

  it('maps checkbox false to "not true", and both values to no constraint', () => {
    expect(parseCustomFieldFilters(fields, ['check:false'])).toEqual([
      { fieldId: 'check', contains: [{ check: true }], negate: true },
    ]);
    expect(
      parseCustomFieldFilters(fields, ['check:true', 'check:false']),
    ).toEqual([{ fieldId: 'check', contains: [], negate: false }]);
  });

  it('keeps colons inside the value', () => {
    expect(parseCustomFieldFilters(fields, ['person:a:b'])[0].contains).toEqual(
      [{ person: 'a:b' }],
    );
  });

  it.each([
    ['drop'],
    [':o1'],
    ['drop:'],
    ['nope:o1'],
    ['text:x'],
    ['check:yes'],
  ])('rejects %s', (param) => {
    expect(() => parseCustomFieldFilters(fields, [param])).toThrow(
      BadRequestException,
    );
  });
});
