import type { SupabaseService } from '../supabase/supabase.service.js';

/** Removes the given work items' uploaded files from Supabase Storage so cascade-deleting
 * their attachment rows (via a list/project/workspace delete) doesn't leave orphaned
 * files behind. */
export async function cleanupWorkItemStorageFiles(
  supabase: SupabaseService,
  bucket: string,
  workItemIds: string[],
): Promise<void> {
  await Promise.all(
    workItemIds.map(async (workItemId) => {
      const { data } = await supabase.adminClient.storage
        .from(bucket)
        .list(`work-items/${workItemId}`);

      if (!data?.length) {
        return;
      }

      const paths = data.map((file) => `work-items/${workItemId}/${file.name}`);
      await supabase.adminClient.storage.from(bucket).remove(paths);
    }),
  );
}
