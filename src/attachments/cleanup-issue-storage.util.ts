import type { SupabaseService } from '../supabase/supabase.service.js';

/** Removes the given issues' uploaded files from Supabase Storage so cascade-deleting
 * their attachment rows (via a list/project/workspace delete) doesn't leave orphaned
 * files behind. */
export async function cleanupIssueStorageFiles(
  supabase: SupabaseService,
  bucket: string,
  issueIds: string[],
): Promise<void> {
  await Promise.all(
    issueIds.map(async (issueId) => {
      const { data } = await supabase.adminClient.storage
        .from(bucket)
        .list(`issues/${issueId}`);

      if (!data?.length) {
        return;
      }

      const paths = data.map((file) => `issues/${issueId}/${file.name}`);
      await supabase.adminClient.storage.from(bucket).remove(paths);
    }),
  );
}
