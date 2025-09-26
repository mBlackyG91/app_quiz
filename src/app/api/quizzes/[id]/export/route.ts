import { NextResponse } from "next/server";
import { createServiceRole } from "@/lib/supabase-server";

type AnswerRow = {
  submission_id: string;
  question_id: string;
  option_id: string | null;
  value_text: string | null;
  value_number: number | null;
  submissions: {
    quiz_id: string;
    user_id: string;
    created_at: string;
  };
  questions: {
    label: string | null;
    qtype: "single" | "multiple" | "text" | "number";
    order: number;
  };
};

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServiceRole();

  const { data, error } = await supabase
    .from("answers")
    .select(
      `
      submission_id,
      question_id,
      option_id,
      value_text,
      value_number,
      submissions!inner(quiz_id, user_id, created_at),
      questions!inner(label, qtype, "order")
    `
    )
    .eq("submissions.quiz_id", params.id)
    // ❗ corect: ordonează pe tabela embed-ată cu foreignTable
    .order("created_at", { ascending: true, foreignTable: "submissions" })
    .order("order", { ascending: true, foreignTable: "questions" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: AnswerRow[] = (data ?? []) as unknown as AnswerRow[];

  const head = [
    "quiz_id",
    "submission_id",
    "user_id",
    "submitted_at",
    "question_id",
    "question_order",
    "question_label",
    "qtype",
    "option_id",
    "value_text",
    "value_number",
  ];

  const lines: string[] = [head.join(",")];

  for (const r of rows) {
    const quizId = r.submissions.quiz_id;
    const userId = r.submissions.user_id;
    const subAt = r.submissions.created_at;
    const qOrder = r.questions.order;
    const qLabel = (r.questions.label ?? "").replaceAll('"', '""');

    const vals = [
      quizId,
      r.submission_id,
      userId,
      subAt,
      r.question_id,
      String(qOrder),
      `"${qLabel}"`,
      r.questions.qtype,
      r.option_id ?? "",
      r.value_text ? `"${String(r.value_text).replaceAll('"', '""')}"` : "",
      r.value_number != null ? String(r.value_number) : "",
    ];

    lines.push(vals.join(","));
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quiz_${params.id}.csv"`,
    },
  });
}
