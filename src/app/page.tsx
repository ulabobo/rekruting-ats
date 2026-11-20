import { cookies } from "next/headers";
import AtsDashboard from "@/components/AtsDashboard";
import { getFullDatabase, getUserById } from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const uid = cookieStore.get("aura_uid")?.value;
  const user = uid ? await getUserById(uid) : null;
  const db = await getFullDatabase();

  return <AtsDashboard initialDb={db} initialUser={user} />;
}
