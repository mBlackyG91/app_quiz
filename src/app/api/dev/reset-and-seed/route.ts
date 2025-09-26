// src/app/api/dev/reset-and-seed/route.ts
import { NextResponse } from "next/server";
import { createServer, createServiceRole } from "@/lib/supabase-server";

type IdRow = { id: string };
type SubmissionRow = { id: string };
type QRow = { id: string; order: number };

type SeedOption = {
  text: string;
  correct?: boolean;
  value?: string | null;
  order?: number;
};
type SeedQuestion = {
  label: string;
  qtype: "single" | "multiple" | "text" | "number";
  required: boolean;
  order: number;
  // poți folosi oricare din câmpuri în JSON-ul tău
  options?: SeedOption[];
  choices?: SeedOption[];
};

type SeedPayload = {
  title: string;
  description?: string | null;
  questions: SeedQuestion[];
};

export async function POST(req: Request) {
  try {
    // 0) payload
    const payload = (await req.json()) as SeedPayload;
    if (!payload?.title || !Array.isArray(payload?.questions)) {
      return NextResponse.json(
        { ok: false, error: "payload.title sau payload.questions lipsesc" },
        { status: 400 }
      );
    }

    // 1) clienți supabase
    const admin = await createServiceRole(); // bypass RLS
    const ssr = await createServer(); // sesiunea curentă (user logat)

    // 1.1) ownerId = userul logat, fallback = primul profil admin
    const { data: me } = await ssr.auth.getUser();
    let ownerId: string | null = me?.user?.id ?? null;

    if (!ownerId) {
      const { data: p } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      ownerId = p?.id ?? null;
    }

    if (!ownerId) {
      return NextResponse.json(
        { ok: false, error: "Nu am găsit un ownerId (user/admin)." },
        { status: 400 }
      );
    }

    // 2) ȘTERGERE: answers -> submissions -> options -> questions -> quizzes
    const { data: quizzes = [] as IdRow[] } = await admin
      .from("quizzes")
      .select("id");

    const quizIds: string[] = (quizzes ?? []).map((q) => q.id);

    if (quizIds.length > 0) {
      // submissions (și answers) pentru aceste quiz-uri
      const { data: subs = [] as SubmissionRow[] } = await admin
        .from("submissions")
        .select("id")
        .in("quiz_id", quizIds);

      const subIds: string[] = (subs ?? []).map((s) => s.id);

      if (subIds.length > 0) {
        // întâi answers, apoi submissions
        await admin.from("answers").delete().in("submission_id", subIds);
        await admin.from("submissions").delete().in("id", subIds);
      }

      // questions + options
      const { data: qs = [] as IdRow[] } = await admin
        .from("questions")
        .select("id")
        .in("quiz_id", quizIds);

      const qIds: string[] = (qs ?? []).map((r) => r.id);

      if (qIds.length > 0) {
        await admin.from("options").delete().in("question_id", qIds);
        await admin.from("questions").delete().in("id", qIds);
      }

      // la final ștergem quiz-urile
      await admin.from("quizzes").delete().in("id", quizIds);
    }

    // 3) INSERT quiz nou
    const { data: quiz, error: insQuizErr } = await admin
      .from("quizzes")
      .insert({
        title: payload.title,
        description: payload.description ?? null,
        is_published: false,
        created_by: ownerId,
      })
      .select("id")
      .single();

    if (insQuizErr || !quiz?.id) {
      return NextResponse.json(
        {
          ok: false,
          step: "insert_quiz",
          error: insQuizErr?.message ?? "insert quiz failed",
        },
        { status: 500 }
      );
    }

    const quizId = quiz.id as string;

    // 4) INSERT întrebări (doar câmpurile din tabel)
    const qRows = payload.questions.map((q) => ({
      quiz_id: quizId,
      label: q.label,
      qtype: q.qtype,
      required: q.required,
      order: q.order,
    }));

    const { data: insertedQs = [] as QRow[], error: insQErr } = await admin
      .from("questions")
      .insert(qRows)
      .select("id,order");

    if (insQErr) {
      return NextResponse.json(
        { ok: false, step: "insert_questions", error: insQErr.message },
        { status: 500 }
      );
    }

    // 5) Mapăm întrebarea inserată după „order” ca să potrivim cu payload
    const byOrder = new Map<number, string>();
    for (const r of insertedQs ?? []) {
      byOrder.set(Number(r.order), String(r.id));
    }

    // 6) INSERT opțiuni (dacă există)
    type OptionRow = {
      question_id: string;
      text: string;
      value: string | null;
      order: number;
    };

    const optionsRows: OptionRow[] = [];

    // păstrăm ordinea: sortăm întrebările după „order”
    (insertedQs ?? [])
      .sort((a, b) => Number(a.order) - Number(b.order))
      .forEach((_inserted, idx) => {
        const srcQ = payload.questions[idx];
        if (!srcQ) return;

        const list = srcQ.options ?? srcQ.choices ?? [];
        list.forEach((opt, j) => {
          const qid = byOrder.get(srcQ.order);
          if (!qid) return;

          optionsRows.push({
            question_id: qid,
            text: opt.text,
            value:
              typeof opt.correct === "boolean"
                ? opt.correct
                  ? "1"
                  : "0"
                : opt.value ?? null,
            order: opt.order ?? j + 1,
          });
        });
      });

    if (optionsRows.length) {
      const { error: insOptErr } = await admin
        .from("options")
        .insert(optionsRows);
      if (insOptErr) {
        return NextResponse.json(
          { ok: false, step: "insert_options", error: insOptErr.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      quiz_id: quizId,
      seeded_questions: (insertedQs ?? []).length,
      seeded_options: optionsRows.length,
    });
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
