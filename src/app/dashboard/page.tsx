// src/app/dashboard/page.tsx
import { createServer } from "@/lib/supabase-server";

export default async function Dashboard() {
  const supabase = await createServer(); // <- e async
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>Dashboard</h1>
      <p>Salut, {user?.email}</p>
    </div>
  );
}
