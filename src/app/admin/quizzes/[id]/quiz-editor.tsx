"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowser } from "@/lib/supabase-browser";

type QType = "single" | "multiple" | "text" | "number";

type Question = {
  id: string;
  quiz_id: string;
  label: string;
  qtype: QType;
  required: boolean;
  order: number | null;
};

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
};

type OptionRow = {
  id: string;
  question_id: string;
  text: string;
  value: string | null; // "1" => corect, altfel null
  order: number | null;
};

type OptionDraft = {
  id?: string; // lipsă => de inserat
  text: string;
  correct: boolean; // UI boolean; mapăm la value "1"/null
  order: number;
};

/** Util: transformă OptionRow DB -> OptionDraft UI */
function toDraft(o: OptionRow): OptionDraft {
  return {
    id: o.id,
    text: o.text ?? "",
    correct: o.value === "1",
    order: Number(o.order ?? 0),
  };
}
/** Util: transformă OptionDraft UI -> row pentru DB */
function toRow(
  qid: string,
  d: OptionDraft
): Omit<OptionRow, "id"> & { id?: string } {
  return {
    ...(d.id ? { id: d.id } : {}),
    question_id: qid,
    text: d.text.trim(),
    value: d.correct ? "1" : null,
    order: d.order,
  };
}

export default function QuizEditor({ quizId }: { quizId: string }) {
  const supabase = useMemo(() => createBrowser(), []);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // care card este deschis
  const [openId, setOpenId] = useState<string | null>(null);

  // drafts de întrebare (titlu/tip/required)
  const [drafts, setDrafts] = useState<Record<string, Partial<Question>>>({});

  // ====== OPTIONS state ======
  // opțiunile curente în UI, per întrebare
  const [optDraftsByQ, setOptDraftsByQ] = useState<
    Record<string, OptionDraft[]>
  >({});
  // id-urile DB inițiale (ca să știm ce trebuie șters la Save)
  const [initialOptIdsByQ, setInitialOptIdsByQ] = useState<
    Record<string, string[]>
  >({});
  const [savingOpts, setSavingOpts] = useState<string | null>(null); // qid în lucru

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 1) quiz
      const { data: q, error: qErr } = await supabase
        .from("quizzes")
        .select("id,title,description,is_published")
        .eq("id", quizId)
        .maybeSingle();

      if (!cancelled) {
        if (qErr) console.error("load quiz error:", qErr.message);
        if (q) {
          setQuiz(q);
          setTitle(q.title ?? "");
          setIsPublic(Boolean(q.is_published));
        }
      }

      // 2) questions
      const { data: qs, error: qsErr } = await supabase
        .from("questions")
        .select("id,quiz_id,label,qtype,required,order")
        .eq("quiz_id", quizId)
        .order("order", { ascending: true });

      if (!cancelled) {
        if (qsErr) console.error("load questions error:", qsErr.message);
        const list = qs ?? [];
        setQuestions(list);

        // 3) options pentru toate întrebările (doar dacă avem întrebări)
        if (list.length) {
          const qids = list.map((x) => x.id);
          const { data: opts, error: oErr } = await supabase
            .from("options")
            .select("id,question_id,text,value,order")
            .in("question_id", qids)
            .order("order", { ascending: true });

          if (oErr) {
            console.error("load options error:", oErr.message);
            setOptDraftsByQ({});
            setInitialOptIdsByQ({});
          } else {
            const byQ: Record<string, OptionDraft[]> = {};
            const initIds: Record<string, string[]> = {};
            (opts ?? []).forEach((o) => {
              const key = o.question_id;
              byQ[key] = byQ[key] ?? [];
              byQ[key].push(toDraft(o));
              initIds[key] = initIds[key] ?? [];
              initIds[key].push(o.id);
            });
            setOptDraftsByQ(byQ);
            setInitialOptIdsByQ(initIds);
          }
        } else {
          setOptDraftsByQ({});
          setInitialOptIdsByQ({});
        }

        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, supabase]);

  async function handleSaveQuiz() {
    if (!quiz) return;
    setSaving(true);
    const { error } = await supabase
      .from("quizzes")
      .update({ title: title.trim(), is_published: isPublic })
      .eq("id", quiz.id);

    if (error) {
      alert("Eroare la salvarea chestionarului: " + error.message);
    } else {
      alert("Chestionar salvat.");
    }
    setSaving(false);
  }

  function openEditor(q: Question) {
    setOpenId((curr) => (curr === q.id ? null : q.id));
    setDrafts((d) => ({
      ...d,
      [q.id]: {
        label: q.label ?? "",
        qtype: q.qtype,
        required: q.required,
      },
    }));
  }

  function patchDraft(qid: string, patch: Partial<Question>) {
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], ...patch } }));
  }

  async function saveQuestion(qid: string) {
    const draft = drafts[qid];
    if (!draft) return;

    const patch = {
      label: (draft.label ?? "").toString().trim(),
      qtype: (draft.qtype ?? "single") as QType,
      required: Boolean(draft.required),
    };

    const { error } = await supabase
      .from("questions")
      .update(patch)
      .eq("id", qid);
    if (error) {
      alert("Eroare la salvarea întrebării: " + error.message);
      return;
    }

    // reflectă în listă
    setQuestions((qs) =>
      qs.map((q) => (q.id === qid ? { ...q, ...patch } : q))
    );
    setOpenId(null);
  }

  async function addQuestion() {
    const nextOrder =
      (questions.reduce((m, q) => Math.max(m, q.order ?? 0), 0) || 0) + 1;

    const insertRow = {
      quiz_id: quizId,
      label: "",
      qtype: "single" as QType,
      required: true,
      order: nextOrder,
    };

    const { data, error } = await supabase
      .from("questions")
      .insert(insertRow)
      .select("id,quiz_id,label,qtype,required,order")
      .maybeSingle();

    if (error) {
      alert("Eroare la adăugare întrebare: " + error.message);
      return;
    }
    if (data) {
      setQuestions((qs) =>
        [...qs, data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      );
      // init opțiuni pentru întrebarea nouă
      setOptDraftsByQ((m) => ({ ...m, [data.id]: [] }));
      setInitialOptIdsByQ((m) => ({ ...m, [data.id]: [] }));
      openEditor(data);
    }
  }

  // ===== OPTIONS UI helpers =====
  const canHaveOptions = (qtype: QType) =>
    qtype === "single" || qtype === "multiple";

  function addOption(qid: string) {
    setOptDraftsByQ((m) => {
      const arr = [...(m[qid] ?? [])];
      const nextOrder =
        (arr.reduce((mx, r) => Math.max(mx, r.order || 0), 0) || 0) + 1;
      arr.push({ text: "", correct: false, order: nextOrder });
      return { ...m, [qid]: arr };
    });
  }

  function patchOption(qid: string, idx: number, patch: Partial<OptionDraft>) {
    setOptDraftsByQ((m) => {
      const arr = [...(m[qid] ?? [])];
      arr[idx] = { ...arr[idx], ...patch };
      return { ...m, [qid]: arr };
    });
  }

  function removeOption(qid: string, idx: number) {
    setOptDraftsByQ((m) => {
      const arr = [...(m[qid] ?? [])];
      arr.splice(idx, 1);
      return { ...m, [qid]: arr };
    });
  }

  async function saveOptionsForQuestion(qid: string) {
    setSavingOpts(qid);
    try {
      const arr = optDraftsByQ[qid] ?? [];
      const initialIds = new Set(initialOptIdsByQ[qid] ?? []);

      // 1) upsert (insert/update)
      if (arr.length) {
        const rows = arr.map((d) => toRow(qid, d));
        const { data, error } = await supabase
          .from("options")
          .upsert(rows, { onConflict: "id" }) // dacă are id -> update; fără id -> insert
          .select("id");

        if (error) {
          alert("Eroare la salvarea opțiunilor: " + error.message);
          return;
        }

        // după upsert primim id-urile (inclusiv pentru cele noi)
        // reconstruim map-ul de drafts + lista inițială
        const { data: fresh, error: freshErr } = await supabase
          .from("options")
          .select("id,question_id,text,value,order")
          .eq("question_id", qid)
          .order("order", { ascending: true });

        if (freshErr) {
          alert("Eroare la reîncărcarea opțiunilor: " + freshErr.message);
          return;
        }

        const drafts = (fresh ?? []).map(toDraft);
        setOptDraftsByQ((m) => ({ ...m, [qid]: drafts }));
        setInitialOptIdsByQ((m) => ({
          ...m,
          [qid]: (fresh ?? []).map((r) => r.id),
        }));

        // scoatem din initialIds tot ce încă există
        for (const r of fresh ?? []) initialIds.delete(r.id);
      }

      // 2) delete pentru ce nu mai există în UI (ce a rămas în initialIds)
      const toDelete = Array.from(initialIds);
      if (toDelete.length) {
        const { error: delErr } = await supabase
          .from("options")
          .delete()
          .in("id", toDelete);
        if (delErr) {
          alert("Eroare la ștergerea opțiunilor: " + delErr.message);
          return;
        }
      }

      alert("Opțiuni salvate.");
    } finally {
      setSavingOpts(null);
    }
  }

  // ====== RENDER ======
  if (loading) {
    return (
      <div className="p-6 text-sm text-gray-500">Se încarcă chestionarul…</div>
    );
  }
  if (!quiz) {
    return (
      <div className="p-6 text-red-600">
        Nu am găsit chestionarul (ID: {quizId}).
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl space-y-4">
      {/* header chestionar */}
      <div className="flex items-center gap-3">
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Titlul chestionarului"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Public
        </label>
        <button
          onClick={handleSaveQuiz}
          disabled={saving}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-60"
        >
          {saving ? "Se salvează…" : "Salvează"}
        </button>
      </div>

      {/* lista întrebări */}
      <div className="space-y-2">
        {questions.length === 0 ? (
          <div className="text-sm text-gray-500">
            Nu există întrebări. Folosește “+ Întrebare” ca să adaugi.
          </div>
        ) : (
          questions.map((q, i) => {
            const isOpen = openId === q.id;
            const draft = drafts[q.id] ?? {};
            const localType = (draft.qtype ?? q.qtype) as QType;
            const showOptions = canHaveOptions(localType);
            const optArr = optDraftsByQ[q.id] ?? [];

            return (
              <div key={q.id} className="rounded border p-3 text-sm">
                {/* bară titlu card */}
                <button
                  type="button"
                  onClick={() => openEditor(q)}
                  className="w-full text-left flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">
                      #{i + 1} {q.label || <em>(fără titlu)</em>}
                    </div>
                    <div className="text-gray-500">
                      Tip: {q.qtype} · Obligatorie: {q.required ? "da" : "nu"}
                    </div>
                  </div>
                  <span className="text-gray-400">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <>
                    {/* editor întrebare */}
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-3">
                        <label className="block mb-1 text-xs text-gray-500">
                          Titlu întrebare
                        </label>
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={draft.label ?? ""}
                          onChange={(e) =>
                            patchDraft(q.id, { label: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <label className="block mb-1 text-xs text-gray-500">
                          Tip
                        </label>
                        <select
                          className="border rounded px-2 py-1 w-full"
                          value={localType}
                          onChange={(e) =>
                            patchDraft(q.id, { qtype: e.target.value as QType })
                          }
                        >
                          <option value="single">single</option>
                          <option value="multiple">multiple</option>
                          <option value="text">text</option>
                          <option value="number">number</option>
                        </select>
                      </div>

                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.required ?? q.required)}
                            onChange={(e) =>
                              patchDraft(q.id, { required: e.target.checked })
                            }
                          />
                          Obligatorie
                        </label>
                      </div>

                      <div className="sm:col-span-3 flex gap-2">
                        <button
                          onClick={() => saveQuestion(q.id)}
                          className="px-3 py-2 rounded bg-black text-white"
                        >
                          Salvează întrebarea
                        </button>
                        <button
                          onClick={() => setOpenId(null)}
                          className="px-3 py-2 rounded border"
                        >
                          Anulează
                        </button>
                      </div>
                    </div>

                    {/* OPTIONS editor (single/multiple) */}
                    {showOptions && (
                      <div className="mt-4">
                        <div className="font-medium mb-2">Opțiuni</div>

                        {optArr.length === 0 && (
                          <div className="text-gray-500 text-sm mb-2">
                            Nu există opțiuni. Adaugă cel puțin una.
                          </div>
                        )}

                        <div className="space-y-2">
                          {optArr.map((opt, idx) => (
                            <div
                              key={opt.id ?? `n-${idx}`}
                              className="grid gap-2 sm:grid-cols-12 items-end"
                            >
                              <div className="sm:col-span-7">
                                <label className="block mb-1 text-xs text-gray-500">
                                  Text
                                </label>
                                <input
                                  className="border rounded px-2 py-1 w-full"
                                  value={opt.text}
                                  onChange={(e) =>
                                    patchOption(q.id, idx, {
                                      text: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block mb-1 text-xs text-gray-500">
                                  Ordine
                                </label>
                                <input
                                  type="number"
                                  className="border rounded px-2 py-1 w-full"
                                  value={opt.order}
                                  onChange={(e) =>
                                    patchOption(q.id, idx, {
                                      order: Number(e.target.value || 0),
                                    })
                                  }
                                />
                              </div>

                              <div className="sm:col-span-2 flex items-center h-[38px] mt-[22px]">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={opt.correct}
                                    onChange={(e) =>
                                      patchOption(q.id, idx, {
                                        correct: e.target.checked,
                                      })
                                    }
                                  />
                                  Corect
                                </label>
                              </div>

                              <div className="sm:col-span-1 mt-[22px]">
                                <button
                                  className="px-2 py-1 border rounded w-full"
                                  onClick={() => removeOption(q.id, idx)}
                                >
                                  Șterge
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => addOption(q.id)}
                            className="px-3 py-2 rounded border"
                          >
                            + Opțiune
                          </button>
                          <button
                            onClick={() => saveOptionsForQuestion(q.id)}
                            disabled={savingOpts === q.id}
                            className="px-3 py-2 rounded bg-black text-white disabled:opacity-60"
                          >
                            {savingOpts === q.id
                              ? "Se salvează…"
                              : "Salvează opțiunile"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* adăugare întrebare */}
      <button onClick={addQuestion} className="px-3 py-2 rounded border">
        + Întrebare
      </button>
    </div>
  );
}
