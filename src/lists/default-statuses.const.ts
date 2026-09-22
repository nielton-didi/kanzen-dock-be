import type { StatusCategory } from '../generated/prisma/enums.js';

/** Seeded into every newly-created list. */
export const DEFAULT_STATUSES: {
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
}[] = [
  { name: 'Backlog', color: 'gray', category: 'not_started', position: 0 },
  { name: 'Todo', color: 'blue', category: 'not_started', position: 1 },
  { name: 'In Progress', color: 'yellow', category: 'active', position: 0 },
  { name: 'Done', color: 'green', category: 'done', position: 0 },
  { name: 'Cancelled', color: 'red', category: 'closed', position: 0 },
];
