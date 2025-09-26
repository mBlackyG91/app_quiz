"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowser } from "@/lib/supabase-browser";
import type { Quiz, Question, Option } from "@/types/quiz";

type AnswerValue = string | string[] | number; // ce reținem în formular
type Values = Record<string, AnswerValue | undefined>;

type AnswerRow = {
  submission_id: string;
  question_id: string;
  option_id: string | null;
  value_text: string | null;
  value_number: number | null;
};

export default function QuizRunner({
  quiz,
  questions,
  options,
}: {
  quiz: Quiz;
  questions: Question[];
  options: Option[];
}) {
  const supabase = createBrowser();
  const router = useRouter();

  // map opțiuni după întrebare
  const byQuestion = useMemo(() => {
    const m: Record<string, Option[]> = {};
    for (const o of options) {
      (m[o.question_id] ??= []).push(o);
    }
    return m;
  }, [options]);

  const [values, setValues] = useState<Values>({});

  const setVal = (qid: string, v: AnswerValue) =>
    setValues((prev) => ({ ...prev, [qid]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // trebuie user logat
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // 1) submission
    const { data: sub, error: subErr } = await supabase
      .from("submissions")
      .insert({ quiz_id: quiz.id, user_id: user.id })
      .select("id")
      .single();

    if (subErr || !sub) return;

    // 2) answers
    const rows: AnswerRow[] = [];

    for (const q of questions) {
      const v = values[q.id];

      if (q.qtype === "single") {
        if (!v || typeof v !== "string") continue;
        rows.push({
          submission_id: sub.id,
          question_id: q.id,
          option_id: v, // păstrăm id-ul opțiunii
          value_text: null,
          value_number: null,
        });
      } else if (q.qtype === "multiple") {
        if (!Array.isArray(v)) continue;
        for (const optId of v) {
          rows.push({
            submission_id: sub.id,
            question_id: q.id,
            option_id: optId,
            value_text: null,
            value_number: null,
          });
        }
      } else if (q.qtype === "text") {
        if (typeof v !== "string" || v.trim() === "") continue;
        rows.push({
          submission_id: sub.id,
          question_id: q.id,
          option_id: null,
          value_text: v,
          value_number: null,
        });
      } else if (q.qtype === "number") {
        const num =
          typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
        if (!Number.isFinite(num)) continue;
        rows.push({
          submission_id: sub.id,
          question_id: q.id,
          option_id: null,
          value_text: null,
          value_number: num,
        });
      }
    }

    if (rows.length > 0) {
      await supabase.from("answers").insert(rows);
    }

    router.push(`/quiz/${quiz.id}/thanks`);
  };

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 680, margin: "24px auto" }}>
      <h1 style={{ marginBottom: 12 }}>{quiz.title}</h1>
      {quiz.description && (
        <p style={{ marginBottom: 24, opacity: 0.8 }}>{quiz.description}</p>
      )}

      {questions.map((q) => {
        const opts = byQuestion[q.id] || [];

        return (
          <div key={q.id} style={{ margin: "18px 0" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {q.label} {q.required ? "*" : ""}
            </div>

            {q.qtype === "single" && (
              <div style={{ display: "grid", gap: 8 }}>
                {opts.map((o) => (
                  <label key={o.id} style={{ display: "flex", gap: 8 }}>
                    <input
                      type="radio"
                      name={q.id}
                      value={o.id}
                      checked={values[q.id] === o.id}
                      onChange={(e) => setVal(q.id, e.target.value)}
                    />
                    <span>{o.text}</span>
                  </label>
                ))}
              </div>
            )}

            {q.qtype === "multiple" && (
              <div style={{ display: "grid", gap: 8 }}>
                {opts.map((o) => {
                  const current = (values[q.id] as string[] | undefined) ?? [];
                  const checked = current.includes(o.id);
                  return (
                    <label key={o.id} style={{ display: "flex", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const set = new Set(current);
                          if (e.target.checked) set.add(o.id);
                          else set.delete(o.id);
                          setVal(q.id, Array.from(set));
                        }}
                      />
                      <span>{o.text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.qtype === "text" && (
              <input
                type="text"
                value={(values[q.id] as string | undefined) ?? ""}
                onChange={(e) => setVal(q.id, e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            )}

            {q.qtype === "number" && (
              <input
                type="number"
                value={
                  typeof values[q.id] === "number"
                    ? String(values[q.id])
                    : (values[q.id] as string | undefined) ?? ""
                }
                onChange={(e) => setVal(q.id, e.target.value)}
                style={{ width: "100%", padding: 8 }}
              />
            )}
          </div>
        );
      })}

      <button type="submit" style={{ marginTop: 16 }}>
        Trimite
      </button>
    </form>
  );
}
