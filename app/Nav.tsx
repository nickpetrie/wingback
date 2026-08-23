import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <nav className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 text-sm">
      <div className="flex gap-4 font-medium">
        <Link href="/pick">Pick</Link>
        <Link href="/album">Album</Link>
        <Link href="/leaderboard">Leaderboard</Link>
      </div>
      <form action={signOut}>
        <button type="submit" className="text-neutral-500 hover:text-neutral-900">
          Sign out
        </button>
      </form>
    </nav>
  );
}
