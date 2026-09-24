import type { StatusCategory } from '../generated/prisma/enums.js';
import {
  buildOptions,
  type FieldKind,
  type OptionInput,
} from '../custom-fields/custom-field-values.js';
import type { StatusColor } from '../statuses/dto/update-status.dto.js';

// List templates (D3): presets copied into a list when it's created. There is
// no live link — editing a template here never changes existing lists.

export type TemplateStatus = {
  name: string;
  category: StatusCategory;
  color: StatusColor;
};

/** Options have no ids here: each list gets fresh ones from `buildOptions`, like API-created fields. */
export type TemplateField = {
  name: string;
  kind: FieldKind;
  options?: OptionInput[];
};

export type ListTemplate = {
  key: string;
  name: string;
  description: string;
  /** A lucide icon name, rendered by the FE picker. */
  icon: string;
  /** In display order; position is assigned per category on create. */
  statuses: TemplateStatus[];
  fields: TemplateField[];
  /** Not stored on the list yet — there is only one view until VIEW-02. */
  defaultView: { type: 'list' | 'board'; groupBy: 'status' };
};

export const DEFAULT_TEMPLATE_KEY = 'general-tasks';

export const LIST_TEMPLATES: ListTemplate[] = [
  {
    key: 'general-tasks',
    name: 'General tasks',
    description: 'A simple to-do workflow for any kind of work.',
    icon: 'list-checks',
    statuses: [
      { name: 'To do', category: 'not_started', color: 'gray' },
      { name: 'In progress', category: 'active', color: 'yellow' },
      { name: 'Done', category: 'done', color: 'green' },
    ],
    fields: [],
    defaultView: { type: 'list', groupBy: 'status' },
  },
  {
    key: 'bug-tracking',
    name: 'Bug tracking',
    description: 'Triage, fix and verify bugs, with severity and repro steps.',
    icon: 'bug',
    statuses: [
      { name: 'Triage', category: 'not_started', color: 'gray' },
      { name: 'Confirmed', category: 'not_started', color: 'blue' },
      { name: 'In progress', category: 'active', color: 'yellow' },
      { name: 'In review', category: 'active', color: 'purple' },
      // Fixed but not yet verified is still open work (QA), so it's active.
      { name: 'Fixed', category: 'active', color: 'teal' },
      { name: 'Verified', category: 'done', color: 'green' },
      { name: "Won't fix", category: 'closed', color: 'gray' },
    ],
    fields: [
      // Same labels and colors as the Severity field P0-4 migrated into
      // existing lists, so migrated and new lists match.
      {
        name: 'Severity',
        kind: 'dropdown',
        options: [
          { label: 'Critical', color: 'red' },
          { label: 'High', color: 'orange' },
          { label: 'Medium', color: 'gray' },
          { label: 'Low', color: 'gray' },
        ],
      },
      {
        name: 'Environment',
        kind: 'dropdown',
        options: [
          { label: 'Production', color: 'purple' },
          { label: 'Staging', color: 'blue' },
          { label: 'Development', color: 'gray' },
        ],
      },
      { name: 'Steps to reproduce', kind: 'text' },
      { name: 'Affected version', kind: 'text' },
    ],
    defaultView: { type: 'list', groupBy: 'status' },
  },
  {
    key: 'software-development',
    name: 'Software development',
    description: 'Plan and ship features, bugs and chores through code review.',
    icon: 'code',
    statuses: [
      { name: 'Backlog', category: 'not_started', color: 'gray' },
      { name: 'Todo', category: 'not_started', color: 'blue' },
      { name: 'In progress', category: 'active', color: 'yellow' },
      { name: 'In review', category: 'active', color: 'purple' },
      { name: 'Done', category: 'done', color: 'green' },
    ],
    fields: [
      {
        name: 'Type',
        kind: 'dropdown',
        options: [
          { label: 'Feature', color: 'blue' },
          { label: 'Bug', color: 'red' },
          { label: 'Chore', color: 'gray' },
        ],
      },
      { name: 'Story points', kind: 'number' },
      // Free text until sprints exist as a real concept (PLAN-01).
      { name: 'Sprint', kind: 'text' },
    ],
    defaultView: { type: 'board', groupBy: 'status' },
  },
  {
    key: 'feature-requests',
    name: 'Feature requests / roadmap',
    description:
      'Collect requests, weigh impact against effort, and plan them.',
    icon: 'lightbulb',
    statuses: [
      { name: 'Submitted', category: 'not_started', color: 'gray' },
      { name: 'Under review', category: 'not_started', color: 'blue' },
      { name: 'Planned', category: 'not_started', color: 'teal' },
      { name: 'In progress', category: 'active', color: 'yellow' },
      { name: 'Shipped', category: 'done', color: 'green' },
      { name: 'Declined', category: 'closed', color: 'gray' },
    ],
    fields: [
      { name: 'Votes', kind: 'number' },
      { name: 'Requester', kind: 'person' },
      {
        name: 'Impact',
        kind: 'dropdown',
        options: [
          { label: 'High', color: 'green' },
          { label: 'Medium', color: 'yellow' },
          { label: 'Low', color: 'gray' },
        ],
      },
      {
        name: 'Effort',
        kind: 'dropdown',
        options: [
          { label: 'Small', color: 'green' },
          { label: 'Medium', color: 'yellow' },
          { label: 'Large', color: 'orange' },
        ],
      },
    ],
    defaultView: { type: 'board', groupBy: 'status' },
  },
  {
    key: 'support-tickets',
    name: 'Support tickets',
    description: 'Handle customer requests from first reply to resolution.',
    icon: 'life-buoy',
    statuses: [
      { name: 'New', category: 'not_started', color: 'blue' },
      { name: 'Open', category: 'active', color: 'yellow' },
      { name: 'Waiting on customer', category: 'active', color: 'orange' },
      { name: 'Resolved', category: 'done', color: 'green' },
      { name: 'Closed', category: 'closed', color: 'gray' },
    ],
    fields: [
      { name: 'Customer', kind: 'text' },
      {
        name: 'Channel',
        kind: 'dropdown',
        options: [
          { label: 'Email', color: 'blue' },
          { label: 'Chat', color: 'teal' },
          { label: 'Phone', color: 'purple' },
          { label: 'Web form', color: 'gray' },
        ],
      },
      { name: 'SLA due', kind: 'date' },
    ],
    defaultView: { type: 'list', groupBy: 'status' },
  },
  {
    key: 'content-calendar',
    name: 'Content calendar',
    description: 'Take content from idea to published, by channel and date.',
    icon: 'calendar',
    statuses: [
      { name: 'Idea', category: 'not_started', color: 'gray' },
      { name: 'Drafting', category: 'active', color: 'yellow' },
      { name: 'Review', category: 'active', color: 'purple' },
      // Ready and waiting for its date; not done until it's out.
      { name: 'Scheduled', category: 'active', color: 'teal' },
      { name: 'Published', category: 'done', color: 'green' },
    ],
    fields: [
      {
        name: 'Channel',
        kind: 'dropdown',
        options: [
          { label: 'Blog', color: 'blue' },
          { label: 'Newsletter', color: 'purple' },
          { label: 'Social', color: 'magenta' },
          { label: 'Video', color: 'red' },
        ],
      },
      { name: 'Publish date', kind: 'date' },
      { name: 'Author', kind: 'person' },
    ],
    defaultView: { type: 'board', groupBy: 'status' },
  },
];

export const LIST_TEMPLATE_KEYS = LIST_TEMPLATES.map(
  (template) => template.key,
);

export function findListTemplate(key: string): ListTemplate | undefined {
  return LIST_TEMPLATES.find((template) => template.key === key);
}

/**
 * The status and field rows a template copies into a new list. Positions are
 * per category for statuses (matching the (list_id, category, position)
 * index) and sequential for fields. Options go through `buildOptions`, so they
 * get fresh ids and the same validation as fields created through the API.
 */
export function templateRows(template: ListTemplate) {
  const perCategory = new Map<StatusCategory, number>();
  const statuses = template.statuses.map((status) => {
    const position = perCategory.get(status.category) ?? 0;
    perCategory.set(status.category, position + 1);
    return { ...status, position };
  });

  const fields = template.fields.map((field, position) => ({
    name: field.name,
    kind: field.kind,
    options: buildOptions(field.kind, field.options),
    position,
  }));

  return { statuses, fields };
}
