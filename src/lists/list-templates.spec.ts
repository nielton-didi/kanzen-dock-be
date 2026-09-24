import { STATUS_COLORS } from '../statuses/dto/update-status.dto.js';
import {
  DEFAULT_TEMPLATE_KEY,
  findListTemplate,
  LIST_TEMPLATES,
  templateRows,
} from './list-templates.const.js';

describe('list templates', () => {
  it('ships the 6 launch templates with unique keys', () => {
    expect(LIST_TEMPLATES.map((t) => t.key)).toEqual([
      'general-tasks',
      'bug-tracking',
      'software-development',
      'feature-requests',
      'support-tickets',
      'content-calendar',
    ]);
    expect(findListTemplate(DEFAULT_TEMPLATE_KEY)?.name).toBe('General tasks');
    expect(findListTemplate('nope')).toBeUndefined();
  });

  it.each(LIST_TEMPLATES)('$key is a valid list configuration', (template) => {
    const { statuses, fields } = templateRows(template);

    expect(statuses.length).toBeGreaterThan(0);
    expect(new Set(statuses.map((s) => s.name)).size).toBe(statuses.length);
    expect(new Set(fields.map((f) => f.name)).size).toBe(fields.length);
    for (const status of statuses) {
      expect(STATUS_COLORS).toContain(status.color);
    }
    // (category, position) is unique per list.
    const slots = statuses.map((s) => `${s.category}:${s.position}`);
    expect(new Set(slots).size).toBe(slots.length);
    expect(fields.map((f) => f.position)).toEqual(fields.map((_, i) => i));
  });

  it('gives General tasks To do → In progress → Done and no fields', () => {
    const { statuses, fields } = templateRows(
      findListTemplate('general-tasks')!,
    );
    expect(statuses).toEqual([
      { name: 'To do', category: 'not_started', color: 'gray', position: 0 },
      { name: 'In progress', category: 'active', color: 'yellow', position: 0 },
      { name: 'Done', category: 'done', color: 'green', position: 0 },
    ]);
    expect(fields).toEqual([]);
  });

  it('matches the Severity field P0-4 migrated', () => {
    const { fields } = templateRows(findListTemplate('bug-tracking')!);
    const severity = fields.find((f) => f.name === 'Severity')!;
    expect(severity.kind).toBe('dropdown');
    expect(
      severity.options.map(({ label, color }) => ({ label, color })),
    ).toEqual([
      { label: 'Critical', color: 'red' },
      { label: 'High', color: 'orange' },
      { label: 'Medium', color: 'gray' },
      { label: 'Low', color: 'gray' },
    ]);
  });

  it('gives each list fresh option ids', () => {
    const template = findListTemplate('bug-tracking')!;
    const first = templateRows(template).fields[0].options.map((o) => o.id);
    const second = templateRows(template).fields[0].options.map((o) => o.id);
    expect(first.every((id) => id.length > 0)).toBe(true);
    expect(first.some((id, i) => id === second[i])).toBe(false);
  });
});
