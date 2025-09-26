"use client";
import { useMemo, useState } from "react";
import { createBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
};
type Question = {
  id: string;
  label: string;
  qtype: "single" | "multiple" | "text" | "number";
  required: boolean;
  order: number;
};
type Option = {
  id: string;
  question_id: string;
  text: string;
  value: string | null;
  order: number;
};

export default function QuizEditor({
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

  // --- meta
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [isPublished, setPublished] = useState<boolean>(!!quiz?.is_published);

  // --- state local pentru fiecare întrebare (editare)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [qDrafts, setQDrafts] = useState<
    Record<string, Partial<Pick<Question, "label" | "qtype" | "required">>>
  >({});

  // opțiuni grupate pe întrebare
  const optsByQ = useMemo(() => {
    const m: Record<string, Option[]> = {};
    for (const o of options) {
      (m[o.question_id] ||= []).push(o);
    }
    // sortare după "order" pentru afişare stabilă
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.order - b.order));
    return m;
  }, [options]);

  const saveMeta = async () => {
    if (!quiz) return;
    await supabase
      .from("quizzes")
      .update({ title, is_published: isPublished })
      .eq("id", quiz.id);
    router.refresh();
  };

  const addQuestion = async () => {
    if (!quiz) return;
    const ord = (questions.at(-1)?.order ?? 0) + 1;
    const { error } = await supabase.from("questions").insert({
      quiz_id: quiz.id,
      label: "Întrebare nouă",
      qtype: "single",
      required: true,
      order: ord,
    });
    if (!error) router.refresh();
  };

  const saveQuestion = async (q: Question) => {
    const draft = qDrafts[q.id] || {};
    const update: Partial<Question> = {
      label: draft.label ?? q.label,
      qtype: (draft.qtype as Question["qtype"]) ?? q.qtype,
      required: draft.required ?? q.required,
    };
    await supabase.from("questions").update(update).eq("id", q.id);
    setQDrafts((s) => ({ ...s, [q.id]: {} }));
    router.refresh();
  };

  const deleteQuestion = async (q: Question) => {
    if (!confirm("Ștergi întrebarea? (și toate opțiunile ei)")) return;
    // opțiunile au FK cu cascade? Dacă nu, ștergem manual mai întâi opțiunile
    await supabase.from("options").delete().eq("question_id", q.id);
    await supabase.from("questions").delete().eq("id", q.id);
    router.refresh();
  };

  // --- opțiuni
  const addOption = async (q: Question) => {
    const current = optsByQ[q.id] || [];
    const ord = (current.at(-1)?.order ?? 0) + 1;
    await supabase.from("options").insert({
      question_id: q.id,
      text: "Opțiune nouă",
      value: null,
      order: ord,
    });
    router.refresh();
  };

  const updateOption = async (o: Option, patch: Partial<Option>) => {
    await supabase.from("options").update(patch).eq("id", o.id);
    router.refresh();
  };

  const deleteOption = async (o: Option) => {
    await supabase.from("options").delete().eq("id", o.id);
    router.refresh();
  };

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      {/* Header quiz */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            flex: 1,
            padding: 8,
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Public
        </label>
        <button
          onClick={saveMeta}
          style={{
            padding: "8px 12px",
            background: "#111",
            color: "#fff",
            borderRadius: 8,
          }}
        >
          Salvează
        </button>
      </div>

      {/* Lista întrebări */}
      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {questions.map((q) => {
          const d = qDrafts[q.id] || {};
          const qtype =
            (d.qtype as Question["qtype"]) ??
            (q.qtype as Question["qtype"]) ??
            "single";
          const isChoice = qtype === "single" || qtype === "multiple";
          const rows = optsByQ[q.id] || [];

          return (
            <div
              key={q.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 12,
              }}
            >
              {/* header card */}
              <div
                role="button"
                onClick={() => setExpanded((s) => ({ ...s, [q.id]: !s[q.id] }))}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  #{q.order} {(d.label ?? q.label) || "(fără titlu)"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Tip: {qtype} | Obligatorie:{" "}
                  {d.required ?? q.required ? "da" : "nu"}
                </div>
              </div>

              {/* editor expandat */}
              {expanded[q.id] && (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 12, color: "#6b7280" }}>
                      Etichetă
                    </label>
                    <input
                      value={d.label ?? q.label}
                      onChange={(e) =>
                        setQDrafts((s) => ({
                          ...s,
                          [q.id]: { ...s[q.id], label: e.target.value },
                        }))
                      }
                      style={{
                        padding: 8,
                        border: "1px solid #ccc",
                        borderRadius: 6,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "grid", gap: 8 }}>
                      <label style={{ fontSize: 12, color: "#6b7280" }}>
                        Tip
                      </label>
                      <select
                        value={qtype}
                        onChange={(e) =>
                          setQDrafts((s) => ({
                            ...s,
                            [q.id]: {
                              ...s[q.id],
                              qtype: e.target.value as Question["qtype"],
                            },
                          }))
                        }
                        style={{
                          padding: 8,
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          maxWidth: 220,
                        }}
                      >
                        <option value="single">single (radio)</option>
                        <option value="multiple">multiple (checkbox)</option>
                        <option value="text">text</option>
                        <option value="number">number</option>
                      </select>
                    </div>

                    <label
                      style={{ display: "flex", gap: 8, alignItems: "end" }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(d.required ?? q.required)}
                        onChange={(e) =>
                          setQDrafts((s) => ({
                            ...s,
                            [q.id]: { ...s[q.id], required: e.target.checked },
                          }))
                        }
                      />
                      Obligatorie
                    </label>
                  </div>

                  {/* Opțiuni pentru single/multiple */}
                  {isChoice && (
                    <div style={{ marginTop: 4 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>Opțiuni</span>
                        <button
                          onClick={() => addOption(q)}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid #111",
                            borderRadius: 8,
                          }}
                        >
                          + Adaugă opțiune
                        </button>
                      </div>

                      <div style={{ display: "grid", gap: 8 }}>
                        {rows.map((o) => (
                          <div
                            key={o.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 160px auto",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <input
                              value={o.text}
                              onChange={(e) =>
                                updateOption(o, { text: e.target.value })
                              }
                              placeholder="Text"
                              style={{
                                padding: 8,
                                border: "1px solid #ccc",
                                borderRadius: 6,
                              }}
                            />
                            <input
                              value={o.value ?? ""}
                              onChange={(e) =>
                                updateOption(o, { value: e.target.value })
                              }
                              placeholder="Value (opțional)"
                              style={{
                                padding: 8,
                                border: "1px solid #ccc",
                                borderRadius: 6,
                              }}
                            />
                            <button
                              onClick={() => deleteOption(o)}
                              style={{
                                padding: "6px 10px",
                                border: "1px solid #e11",
                                color: "#e11",
                                borderRadius: 8,
                                background: "transparent",
                              }}
                            >
                              Șterge
                            </button>
                          </div>
                        ))}
                        {rows.length === 0 && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              paddingLeft: 2,
                            }}
                          >
                            Nu există opțiuni încă.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* acțiuni */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                      marginTop: 4,
                    }}
                  >
                    <button
                      onClick={() => deleteQuestion(q)}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #e11",
                        color: "#e11",
                        borderRadius: 8,
                        background: "transparent",
                      }}
                    >
                      Șterge întrebarea
                    </button>
                    <button
                      onClick={() => saveQuestion(q)}
                      style={{
                        padding: "8px 12px",
                        background: "#111",
                        color: "#fff",
                        borderRadius: 8,
                      }}
                    >
                      Salvează întrebarea
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={addQuestion}
        style={{
          marginTop: 12,
          padding: "8px 12px",
          border: "1px solid #111",
          borderRadius: 8,
        }}
      >
        + Întrebare
      </button>
    </div>
  );
}
