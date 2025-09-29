// src/app/admin/quizzes/page.tsx
import Link from "next/link";
import { createServer } from "@/lib/supabase-server";

// model minim pentru listă
type QuizRow = {
  id: string;
  title: string | null;
  is_published: boolean;
  created_at: string;
};

export default async function AdminQuizzesPage({
  searchParams,
}: {
  searchParams?: { msg?: string | string[] };
}) {
  // citim eventualul mesaj (?msg=...)
  const msg = Array.isArray(searchParams?.msg)
    ? searchParams?.msg[0]
    : searchParams?.msg;

  // IMPORTANT: client server-side
  // (Dacă la tine `createServer()` *nu* e async, elimină `await`.)
  const supabase = await createServer();

  const { data, error } = await supabase
    .from("quizzes")
    .select("id,title,is_published,created_at")
    .order("created_at", { ascending: false });

  const quizzes: QuizRow[] = (data ?? []) as QuizRow[];

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

      {/* mesaj (ex: redirect din editor când nu găsește quiz-ul) */}
      {msg ? (
        <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-2 text-sm text-yellow-800">
          {msg}
        </div>
      ) : null}

      {/* eroare încărcare din DB */}
      {error ? (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          Eroare la încărcarea chestionarelor: {error.message}
        </div>
      ) : null}

      {quizzes.length === 0 ? (
        <div className="text-sm text-gray-500">Nu există chestionare.</div>
      ) : (
        <div className="space-y-2">
          {quizzes.map((q) => (
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
                  className="px-2 py-1 rounded border"
                >
                  Editează
                </Link>
                <Link
                  href={`/quizzes/${q.id}`}
                  className="px-2 py-1 rounded border"
                >
                  Vezi
                </Link>
                <Link
                  href={`/admin/quizzes/${q.id}/analytics`}
                  className="px-2 py-1 rounded border"
                >
                  Analytics
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
