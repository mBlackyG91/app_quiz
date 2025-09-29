"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowser } from "@/lib/supabase-browser";

/* ======================== Types ======================== */

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
  value: string | null; // "1" => corect; altfel null
  order: number | null;
};

type OptionDraft = {
  id?: string; // prezent => update; absent => insert
  text: string;
  correct: boolean; // în DB devine "1"/null
  order: number;
};

/* DB -> UI */
function toDraft(o: OptionRow): OptionDraft {
  return {
    id: o.id,
    text: o.text ?? "",
    correct: o.value === "1",
    order: Number(o.order ?? 0),
  };
}

/* UI -> DB (fără id pentru rândurile noi) */
function toRow(
  qid: string,
  d: OptionDraft
): Omit<OptionRow, "id"> & { id?: string } {
  const row: Omit<OptionRow, "id"> & { id?: string } = {
    question_id: qid,
    text: d.text.trim(),
    value: d.correct ? "1" : null,
    order: d.order,
  };
  if (d.id) row.id = d.id;
  return row;
}

/* normalizează ordinea: 1,2,3… */
function normalizeOrders(arr: OptionDraft[]): OptionDraft[] {
  const sorted = [...arr].sort((a, b) => (a.order || 0) - (b.order || 0));
  return sorted.map((o, i) => ({ ...o, order: i + 1 }));
}

/* ===================== Component ======================= */

export default function QuizEditor({ quizId }: { quizId: string }) {
  const supabase = useMemo(() => createBrowser(), []);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // card deschis
  const [openId, setOpenId] = useState<string | null>(null);

  // schițe întrebare (label/qtype/required)
  const [drafts, setDrafts] = useState<Record<string, Partial<Question>>>({});

  // OPTIONS state
  const [optDraftsByQ, setOptDraftsByQ] = useState<
    Record<string, OptionDraft[]>
  >({});
  const [initialOptIdsByQ, setInitialOptIdsByQ] = useState<
    Record<string, string[]>
  >({});
  const [savingOpts, setSavingOpts] = useState<string | null>(null);

  /* ============ Load quiz + questions + options ============ */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      // Quiz
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

      // Questions
      const { data: qs, error: qsErr } = await supabase
        .from("questions")
        .select("id,quiz_id,label,qtype,required,order")
        .eq("quiz_id", quizId)
        .order("order", { ascending: true });

      if (!cancelled) {
        if (qsErr) console.error("load questions error:", qsErr.message);
        const list = qs ?? [];
        setQuestions(list);

        // Options
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

  /* =================== Quiz header save =================== */
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

  /* =================== Questions helpers ================== */
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

    if (!patch.label) {
      alert("Titlul întrebării nu poate fi gol.");
      return;
    }

    const { error } = await supabase
      .from("questions")
      .update(patch)
      .eq("id", qid);
    if (error) {
      alert("Eroare la salvarea întrebării: " + error.message);
      return;
    }

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

  async function deleteQuestion(qid: string) {
    if (!confirm("Sigur ștergi întrebarea? Această acțiune este definitivă.")) {
      return;
    }

    // (dacă nu ai FK cascade) – curățăm întâi opțiunile
    const { error: delOptsErr } = await supabase
      .from("options")
      .delete()
      .eq("question_id", qid);
    if (delOptsErr) {
      alert("Eroare la ștergerea opțiunilor: " + delOptsErr.message);
      return;
    }

    const { error: delQErr } = await supabase
      .from("questions")
      .delete()
      .eq("id", qid);
    if (delQErr) {
      alert("Eroare la ștergerea întrebării: " + delQErr.message);
      return;
    }

    setQuestions((qs) => qs.filter((q) => q.id !== qid));

    // curățăm map-urile fără a folosi variabile neutilizate
    setOptDraftsByQ((m) => {
      const next = { ...m };
      delete next[qid];
      return next;
    });
    setInitialOptIdsByQ((m) => {
      const next = { ...m };
      delete next[qid];
      return next;
    });

    if (openId === qid) setOpenId(null);
  }

  /* ==================== Options helpers =================== */
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
      return { ...m, [qid]: normalizeOrders(arr) };
    });
  }

  function moveOption(qid: string, idx: number, dir: -1 | 1) {
    setOptDraftsByQ((m) => {
      const arr = [...(m[qid] ?? [])];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return m;

      // swap by order + normalize
      const a = arr[idx];
      const b = arr[newIdx];
      const tmp = a.order;
      a.order = b.order ?? 0;
      b.order = tmp ?? 0;

      return { ...m, [qid]: normalizeOrders(arr) };
    });
  }

  async function saveOptionsForQuestion(qid: string) {
    setSavingOpts(qid);
    try {
      const arrRaw = optDraftsByQ[qid] ?? [];
      // curăț: rânduri cu text gol dispar
      let arr = arrRaw.filter((o) => (o.text ?? "").trim().length > 0);
      arr = normalizeOrders(arr);

      // reguli de bază în funcție de tip
      const currentQ = questions.find((x) => x.id === qid);
      const qtype = (drafts[qid]?.qtype ??
        currentQ?.qtype ??
        "single") as QType;

      if (!arr.length) {
        alert("Adaugă cel puțin o opțiune (cu text) înainte de salvare.");
        return;
      }
      if (qtype === "single") {
        const cnt = arr.filter((o) => o.correct).length;
        if (cnt !== 1) {
          alert("La „single” trebuie exact o opțiune corectă.");
          return;
        }
      }
      if (qtype === "multiple") {
        const cnt = arr.filter((o) => o.correct).length;
        if (cnt < 1) {
          alert("La „multiple” trebuie cel puțin o opțiune corectă.");
          return;
        }
      }

      // set în UI ordinea normalizată
      setOptDraftsByQ((m) => ({ ...m, [qid]: arr }));

      const initialIds = new Set(initialOptIdsByQ[qid] ?? []);

      // 1) upsert
      const rows = arr.map((d) => toRow(qid, d));
      const { error: upErr } = await supabase
        .from("options")
        .upsert(rows, { onConflict: "id" });
      if (upErr) {
        alert("Eroare la salvarea opțiunilor: " + upErr.message);
        return;
      }

      // 2) reîncărcare (ca să prindem id-urile nou create)
      const { data: fresh, error: freshErr } = await supabase
        .from("options")
        .select("id,question_id,text,value,order")
        .eq("question_id", qid)
        .order("order", { ascending: true });

      if (freshErr) {
        alert("Eroare la reîncărcarea opțiunilor: " + freshErr.message);
        return;
      }

      const draftsFresh = (fresh ?? []).map(toDraft);
      setOptDraftsByQ((m) => ({ ...m, [qid]: draftsFresh }));
      setInitialOptIdsByQ((m) => ({
        ...m,
        [qid]: (fresh ?? []).map((r) => r.id),
      }));

      // 3) șterge ce a dispărut din UI (ce a mai rămas în initialIds)
      for (const r of fresh ?? []) initialIds.delete(r.id);
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

  /* ========================= UI ========================== */

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
            Nu există întrebări. Folosește “+ Întrebare”.
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

                        <button
                          onClick={() => deleteQuestion(q.id)}
                          className="px-3 py-2 rounded border text-red-600 border-red-300 ml-auto"
                        >
                          Șterge întrebarea
                        </button>
                      </div>
                    </div>

                    {/* OPTIONS editor */}
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
                              <div className="sm:col-span-6">
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

                              {/* butoane ↑ ↓ × */}
                              <div className="sm:col-span-2 mt-[22px] flex gap-1 justify-end">
                                <button
                                  className="px-2 py-1 border rounded"
                                  title="Mută sus"
                                  onClick={() => moveOption(q.id, idx, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  className="px-2 py-1 border rounded"
                                  title="Mută jos"
                                  onClick={() => moveOption(q.id, idx, 1)}
                                >
                                  ↓
                                </button>
                                <button
                                  className="px-2 py-1 border rounded"
                                  title="Șterge"
                                  onClick={() => removeOption(q.id, idx)}
                                >
                                  ×
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
