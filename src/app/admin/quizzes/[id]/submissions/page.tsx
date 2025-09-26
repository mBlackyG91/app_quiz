import { createServer } from "@/lib/supabase-server";
import Link from "next/link";

type Submission = { id: string; user_id: string; created_at: string };

export default async function QuizSubmissions({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createServer();

  // opțional: verifică rolul admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin")
    return <div style={{ padding: 24 }}>Nu ai drepturi de admin.</div>;

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title")
    .eq("id", params.id)
    .single();

  const { data: subsRes } = await supabase
    .from("submissions")
    .select("id,user_id,created_at")
    .eq("quiz_id", params.id)
    .order("created_at", { ascending: false });

  const subs: Submission[] = (subsRes ?? []) as Submission[];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>
        Trimiteri — {quiz?.title}
      </h1>
      <div style={{ marginTop: 12 }}>
        <Link href={`/admin/quizzes/`}>&larr; Înapoi la chestionare</Link>
      </div>

      <table
        style={{ marginTop: 16, width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #eee",
                padding: "8px 4px",
              }}
            >
              ID
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #eee",
                padding: "8px 4px",
              }}
            >
              User
            </th>
            <th
              style={{
                textAlign: "left",
                borderBottom: "1px solid #eee",
                padding: "8px 4px",
              }}
            >
              Creat la
            </th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id}>
              <td style={{ padding: "6px 4px" }}>{s.id}</td>
              <td style={{ padding: "6px 4px" }}>{s.user_id}</td>
              <td style={{ padding: "6px 4px" }}>
                {new Date(s.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <a
          href={`/api/quizzes/${params.id}/export`}
          target="_blank"
          style={{
            padding: "8px 12px",
            border: "1px solid #111",
            borderRadius: 8,
          }}
        >
          Export CSV
        </a>
      </div>
    </div>
  );
}
