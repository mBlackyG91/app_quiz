import { createServer } from "@/lib/supabase-server";
import Link from "next/link";

export default async function AdminQuizzes() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return <div style={{ padding: 24 }}>Nu ai drepturi de admin.</div>;
  }

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id,title,is_published,created_at")
    .order("created_at", { ascending: false });

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Admin — Chestionare</h1>
        <Link
          href="/admin/quizzes/new"
          style={{
            padding: "8px 12px",
            background: "#111",
            color: "#fff",
            borderRadius: 8,
          }}
        >
          Chestionar nou
        </Link>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {(quizzes ?? []).map((q) => (
          <div
            key={q.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 600 }}>{q.title}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {q.is_published ? "Public" : "Draft"}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Link
                href={`/admin/quizzes/${q.id}`}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #111",
                  borderRadius: 8,
                }}
              >
                Editează
              </Link>
              <Link
                href={`/admin/quizzes/${q.id}/submissions`}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #111",
                  borderRadius: 8,
                }}
              >
                Trimiteri
              </Link>
              <Link
                href={`/quiz/${q.id}`}
                style={{
                  padding: "6px 10px",
                  background: "#111",
                  color: "#fff",
                  borderRadius: 8,
                }}
              >
                Vezi
              </Link>
              <Link
                href={`/admin/quizzes/${q.id}/analytics`}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #111",
                  borderRadius: 8,
                }}
              >
                Analytics
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
