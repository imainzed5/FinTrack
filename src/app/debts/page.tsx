import DebtsPanel from '@/components/DebtsPanel';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DebtsPage() {
  let viewerUserId = '';

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerUserId = user?.id ?? '';
  } catch {
    viewerUserId = '';
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-4 sm:px-6">
      <div className="rounded-2xl border border-zinc-200 bg-white/95 p-4 dark:border-zinc-800 dark:bg-zinc-900/95">
        <DebtsPanel initialUserId={viewerUserId} />
      </div>
    </div>
  );
}
