import { NextRequest, NextResponse } from "next/server";
import { createServer } from "@/lib/supabase-server";

/* ============ CSV helpers ============ */

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(headers: string[], rows: (string | number | null)[][]): string {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return "\uFEFF" + head + "\n" + body + "\n"; // BOM pentru Excel + EOL final
}

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return isNaN(+dt) ? null : dt;
}

/* ============ Tipuri de rezultat (doar după await) ============ */

type SubmissionSlim = {
  id: string;
  user_id: string | null;
  structure_code: string | null;
  quiz_id: string;
  created_at: string;
};

type AnswerRow = {
  submission_id: string;
  question_id: string;
  option_id: string | null;
  value_text: string | null;
  value_number: number | null;
  created_at: string; // created_at al răspunsului
  submissions: SubmissionSlim; // join
};

/* ============ Handler GET /api/analytics/export ============ */

export async function GET(request: NextRequest) {
  const supabase = await createServer();

  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get("quiz_id");
  const structure = searchParams.get("structure");
  const fromStr = searchParams.get("from"); // YYYY-MM-DD
  const toStr = searchParams.get("to"); // YYYY-MM-DD

  if (!quizId) {
    return NextResponse.json(
      { error: "Parametrul 'quiz_id' este obligatoriu." },
      { status: 400 }
    );
  }

  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  const toEnd = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : null;

  // Construim builder-ul o singură dată, fără cast-uri intermediare.
  const builder = supabase
    .from("answers")
    .select(
      `
      submission_id,
      question_id,
      option_id,
      value_text,
      value_number,
      created_at,
      submissions!inner (
        id,
        user_id,
        structure_code,
        quiz_id,
        created_at
      )
    `
    )
    .eq("submissions.quiz_id", quizId);

  if (structure && structure !== "all") {
    builder.eq("submissions.structure_code", structure);
  }
  if (from) {
    builder.gte("created_at", from.toISOString());
  }
  if (toEnd) {
    builder.lte("created_at", toEnd.toISOString());
  }

  // Tipăm strict doar rezultatul după await,
  // fără a atinge tipurile builder-ului.
  const res = await builder;
  const { data, error } = res as unknown as {
    data: AnswerRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    return NextResponse.json(
      { error: "[export] query failed: " + error.message },
      { status: 500 }
    );
  }

  const headers = [
    "submission_id",
    "user_id",
    "structure_code",
    "submission_created_at",
    "question_id",
    "option_id",
    "value_text",
    "value_number",
    "answer_created_at",
  ];

  const rows = (data ?? []).map<(string | number | null)[]>((r) => {
    const s = r.submissions;
    return [
      s.id,
      s.user_id,
      s.structure_code,
      s.created_at,
      r.question_id,
      r.option_id,
      r.value_text,
      r.value_number,
      r.created_at,
    ];
  });

  const csv = toCSV(headers, rows);

  const fileNameParts = [
    `quiz-${quizId}`,
    structure && structure !== "all" ? structure : "all",
    from ? `from-${fromStr}` : "",
    to ? `to-${toStr}` : "",
  ].filter(Boolean);
  const fileName = `${fileNameParts.join("_")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
