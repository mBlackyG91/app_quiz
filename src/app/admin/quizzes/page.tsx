// src/app/admin/quizzes/page.tsx
import Link from "next/link";
import { createServer } from "@/lib/supabase-server";

// tip pentru query-ul ?msg=
type SP = Record<string, string | string[] | undefined>;

export default async function AdminQuizzesPage({
  searchParams,
}: {
  searchParams: Promise<SP>; // <- în Next 15 vine ca Promise aici
}) {
  // ✅ trebuie așteptat înainte de folosire
  const sp = await searchParams;
  const msg = Array.isArray(sp?.msg) ? sp.msg[0] : sp?.msg;

  const supabase = await createServer();

  const { data: quizzes, error } = await supabase
    .from("quizzes")
    .select("id, title, is_published, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin — Chestionare</h1>

        <Link
          href="/admin/quizzes/new"
          className="px-3 py-2 rounded bg-black text-white hover:opacity-90"
        >
          Chestionar nou
        </Link>
      </div>

      {/* banner pentru mesaje din redirect (?msg=...) */}
      {msg && (
        <div className="mb-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-800 px-3 py-2 text-sm">
          {msg}
        </div>
      )}

      {error ? (
        <div className="text-red-600">Eroare la încărcarea listei.</div>
      ) : (quizzes ?? []).length === 0 ? (
        <div className="text-gray-500 text-sm">Nu există chestionare.</div>
      ) : (
        (quizzes ?? []).map((q) => (
          <div
            key={q.id}
            className="rounded border px-3 py-2 flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{q.title || "(fără titlu)"}</div>
              <div className="text-xs text-gray-500">
                {q.is_published ? "Public" : "Draft"}
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/admin/quizzes/${q.id}`}
                className="px-2 py-1 border rounded text-sm"
              >
                Editează
              </Link>
              <Link
                href={`/quizzes/${q.id}`}
                className="px-2 py-1 border rounded text-sm"
              >
                Vezi
              </Link>
              <Link
                href={`/admin/quizzes/${q.id}/analytics`}
                className="px-2 py-1 border rounded text-sm"
              >
                Analytics
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
