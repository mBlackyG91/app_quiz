// src/app/admin/quizzes/[id]/analytics/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServer } from "@/lib/supabase-server";

/* === grafice (client components) === */
import OptionPieChart, {
  type PieDatum,
} from "@/components/charts/OptionPieChart";

/* ===================== Tipuri ===================== */

type Quiz = {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
};

export type OptionCountRow = {
  quiz_id: string;
  structure_code: string | null;
  question_id: string;
  question_label: string | null;
  option_id: string | null;
  option_text: string | null;
  option_count: number;
};

export type NumericStatRow = {
  quiz_id: string;
  structure_code: string | null;
  question_id: string;
  question_label: string | null;
  n: number;
  avg: number | null;
  min: number | null;
  max: number | null;
};

export type TextLatestRow = {
  quiz_id: string;
  structure_code: string | null;
  question_id: string;
  question_label: string | null;
  value_text: string | null;
  created_at: string; // ISO
};

export type ScoreRow = {
  quiz_id: string;
  structure_code: string | null;
  submission_id: string;
  score_pct: number | null;
};

export type ScoreSummary = {
  quiz_id: string;
  structure_code: string | null;
  submissions_count: number;
  avg_score_pct: number | null;
};

/* ====== Structuri (coduri & label pentru selector) ====== */

const STRUCTURES: { code: string; label: string }[] = [
  { code: "all", label: "Toate structurile" },
  { code: "central", label: "Central" },
  { code: "srcf_bucuresti", label: "SRCF București" },
  { code: "srcf_craiova", label: "SRCF Craiova" },
  { code: "srcf_timisora", label: "SRCF Timișoara" },
  { code: "srcf_cluj", label: "SRCF Cluj" },
  { code: "srcf_brasov", label: "SRCF Brașov" },
  { code: "srcf_iasi", label: "SRCF Iași" },
  { code: "srcf_galati", label: "SRCF Galați" },
  { code: "srcf_constanta", label: "SRCF Constanța" },
];

/* =========== Util: aplică .eq(structure_code) când e setat =========== */
function applyStructureFilter<
  T extends { eq: (col: string, val: string) => T }
>(q: T, structure: string): T {
  return structure !== "all" ? q.eq("structure_code", structure) : q;
}

/* ===================== Pagina ===================== */

type PageProps = {
  params: { id: string };
  searchParams?: { structure?: string };
};

export default async function Page({ params, searchParams }: PageProps) {
  // Evită warning-ul Next "sync dynamic APIs"
  const _params = await Promise.resolve(params);
  const _searchParams = await Promise.resolve(searchParams ?? {});
  const supabase = await createServer();

  const structure = (_searchParams.structure ?? "all").toLowerCase();

  // 1) Load quiz
  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .select("id,title,is_published")
    .eq("id", _params.id)
    .maybeSingle<Quiz>();

  if (quizErr) throw new Error("[analytics] load quiz: " + quizErr.message);
  if (!quiz) notFound();

  // 2) Option counts (single/multiple)
  const q1Base = supabase
    .from("analytics_option_counts")
    .select(
      "quiz_id,structure_code,question_id,question_label,option_id,option_text,option_count"
    )
    .eq("quiz_id", _params.id);

  const { data: optData, error: optErr } = await applyStructureFilter(
    q1Base,
    structure
  );
  if (optErr) throw new Error("[analytics] option_counts: " + optErr.message);

  const optionRows = (optData ?? []) as OptionCountRow[];

  // 2.1) Aduc opțiunile corecte pentru întrebările prezente (din tabela options)
  const qids = Array.from(
    new Set(optionRows.map((r) => r.question_id).filter(Boolean))
  );
  let correctIdsByQ: Record<string, Set<string>> = {};
  if (qids.length) {
    const { data: correctRows, error: corrErr } = await supabase
      .from("options")
      .select("id,question_id,value")
      .in("question_id", qids)
      .eq("value", "1");

    if (corrErr)
      throw new Error("[analytics] load correct options: " + corrErr.message);

    correctIdsByQ = (correctRows ?? []).reduce((acc, r) => {
      const set = acc[r.question_id] ?? new Set<string>();
      if (r.value === "1") set.add(r.id);
      acc[r.question_id] = set;
      return acc;
    }, {} as Record<string, Set<string>>);
  }

  // 3) Numeric stats
  const q2Base = supabase
    .from("analytics_numeric_stats")
    .select("quiz_id,structure_code,question_id,question_label,n,avg,min,max")
    .eq("quiz_id", _params.id);

  const { data: numData, error: numErr } = await applyStructureFilter(
    q2Base,
    structure
  );
  if (numErr) throw new Error("[analytics] numeric_stats: " + numErr.message);

  // 4) Latest text
  const q3Base = supabase
    .from("analytics_text_latest")
    .select(
      "quiz_id,structure_code,question_id,question_label,value_text,created_at"
    )
    .eq("quiz_id", _params.id);

  const { data: txtData, error: txtErr } = await applyStructureFilter(
    q3Base,
    structure
  );
  if (txtErr) throw new Error("[analytics] text_latest: " + txtErr.message);

  // 5) Scores per submission
  const sBase = supabase
    .from("analytics_quiz_scores")
    .select("quiz_id,structure_code,submission_id,score_pct")
    .eq("quiz_id", _params.id);

  const { data: scores, error: sErr } = await applyStructureFilter(
    sBase,
    structure
  );
  if (sErr) throw new Error("[analytics] quiz_scores: " + sErr.message);

  const scoreRows: ScoreRow[] = (scores ?? []) as ScoreRow[];
  const numericScores = scoreRows
    .map((s) => s.score_pct)
    .filter((v): v is number => typeof v === "number");

  const submissions_count = numericScores.length;
  const avg_score_pct =
    submissions_count > 0
      ? Number(
          (
            numericScores.reduce((acc, cur) => acc + cur, 0) / submissions_count
          ).toFixed(2)
        )
      : null;

  const summary: ScoreSummary = {
    quiz_id: _params.id,
    structure_code: structure === "all" ? null : structure,
    submissions_count,
    avg_score_pct,
  };

  /* ====== Derivări pentru tabelul de opțiuni (percent + marcaj corect) ====== */
  const optByQuestion = groupBy<OptionCountRow>(
    optionRows,
    (r) => r.question_id
  );

  const optionTables = Object.entries(optByQuestion)
    .map(([qid, rows]) => {
      const label = rows[0]?.question_label ?? "(fără titlu)";
      const total = rows.reduce((acc, r) => acc + (r.option_count ?? 0), 0);

      // grupăm după text, dar marcăm „corect” dacă oricare din opțiunile cu același text
      // are id care apare în setul de corecte pentru întrebare
      const grouped = groupBy(rows, (r) => (r.option_text ?? "").trim());
      const correctSet = correctIdsByQ[qid] ?? new Set<string>();

      const items = Object.entries(grouped)
        .map(([text, arr]) => {
          const count = arr.reduce((a, b) => a + (b.option_count ?? 0), 0);
          const pct =
            total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
          const isCorrect = arr.some(
            (r) => r.option_id && correctSet.has(r.option_id)
          );
          return {
            option_text: text || "(fără text)",
            count,
            pct,
            isCorrect,
          };
        })
        .sort((a, b) => b.count - a.count);

      const pie: PieDatum[] = items.map((it) => ({
        name: it.option_text,
        value: it.count,
      }));

      return { question_id: qid, label, total, items, pie };
    })
    .sort(
      (a, b) =>
        indexFromLabel(a.label) - indexFromLabel(b.label) ||
        a.label.localeCompare(b.label)
    );

  /* ===================== Render ===================== */

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">
          Analytics — {quiz.title} ·{" "}
          <span className="text-gray-500">
            {STRUCTURES.find((s) => s.code === structure)?.label ??
              "Toate structurile"}
          </span>
        </h1>
        <Link
          href={`/admin/quizzes`}
          className="ml-auto text-sm text-blue-600 hover:underline"
        >
          ← Înapoi la chestionare
        </Link>
      </div>

      {/* Selector structuri */}
      <StructurePicker quizId={quiz.id} active={structure} />

      {/* Rezumat scor */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-3">Rezumat scor</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <StatBox label="Submisii" value={summary.submissions_count} />
          <StatBox
            label="Media scor (%)"
            value={
              summary.avg_score_pct != null ? `${summary.avg_score_pct}` : "—"
            }
          />
          <StatBox
            label="Structură"
            value={
              structure === "all"
                ? "Toate"
                : STRUCTURES.find((s) => s.code === structure)?.label ??
                  structure
            }
          />
        </div>
      </section>

      {/* Opțiuni (single/multiple) */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-3">Opțiuni (single/multiple)</h2>
        {optionTables.length === 0 ? (
          <Empty notice="Nu există răspunsuri pentru întrebările de tip single/multiple." />
        ) : (
          <div className="space-y-6">
            {optionTables.map((q) => (
              <div
                key={q.question_id}
                className="border rounded overflow-hidden"
              >
                <div className="px-3 py-2 border-b bg-gray-50 text-sm font-medium">
                  {q.label}{" "}
                  <span className="text-gray-500 font-normal">
                    (n={q.total})
                  </span>
                </div>

                <div className="flex flex-col xl:flex-row gap-0 xl:gap-3">
                  {/* tabel */}
                  <div className="overflow-x-auto flex-1">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left bg-gray-50">
                          <th className="px-3 py-2 w-2/3">Opțiune</th>
                          <th className="px-3 py-2">Răspunsuri</th>
                          <th className="px-3 py-2">Procent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {q.items.map((it, idx) => (
                          <tr
                            key={`${it.option_text}-${idx}`}
                            className="border-t"
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{it.option_text}</span>
                                {it.isCorrect && (
                                  <span className="text-xs px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700">
                                    corect
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">{it.count}</td>
                            <td className="px-3 py-2">
                              <BarCell pct={it.pct} highlight={it.isCorrect} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* pie chart */}
                  <div className="hidden xl:block shrink-0 w-[360px] border-l">
                    <div className="p-3 min-h-[16rem]">
                      <OptionPieChart
                        data={q.pie}
                        total={q.total}
                        title="Distribuție răspunsuri"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Întrebări numerice */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-3">Întrebări numerice</h2>
        {(numData ?? []).length === 0 ? (
          <Empty notice="Nu există răspunsuri pentru întrebările de tip number." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="px-3 py-2">Întrebare</th>
                  <th className="px-3 py-2">n</th>
                  <th className="px-3 py-2">avg</th>
                  <th className="px-3 py-2">min</th>
                  <th className="px-3 py-2">max</th>
                </tr>
              </thead>
              <tbody>
                {(numData as NumericStatRow[])
                  .slice()
                  .sort(
                    (a, b) =>
                      indexFromLabel(a.question_label ?? "") -
                        indexFromLabel(b.question_label ?? "") ||
                      (a.question_label ?? "").localeCompare(
                        b.question_label ?? ""
                      )
                  )
                  .map((r, i) => {
                    // *** Cheie compusă pentru unicititate ***
                    const sk = r.structure_code ?? "all";
                    const key = `${r.question_id}-${sk}-${i}`;
                    const structLabel =
                      sk === "all"
                        ? null
                        : STRUCTURES.find((s) => s.code === sk)?.label ?? sk;

                    return (
                      <tr key={key} className="border-t">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span>{r.question_label ?? "(fără titlu)"}</span>
                            {structure === "all" && structLabel && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border">
                                {structLabel}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">{r.n}</td>
                        <td className="px-3 py-2">{fmtNumber(r.avg)}</td>
                        <td className="px-3 py-2">{fmtNumber(r.min)}</td>
                        <td className="px-3 py-2">{fmtNumber(r.max)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Răspunsuri text */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-3">Răspunsuri text (cele mai recente)</h2>
        {(txtData ?? []).length === 0 ? (
          <Empty notice="Nu există răspunsuri pentru întrebările de tip text." />
        ) : (
          <div className="space-y-3">
            {(txtData as TextLatestRow[])
              .slice()
              .sort(
                (a, b) =>
                  indexFromLabel(a.question_label ?? "") -
                    indexFromLabel(b.question_label ?? "") ||
                  (a.question_label ?? "").localeCompare(b.question_label ?? "")
              )
              .map((r, i) => {
                // *** Cheie compusă pentru unicititate ***
                const sk = r.structure_code ?? "all";
                const key = `${r.question_id}-${sk}-${i}`;
                const structLabel =
                  sk === "all"
                    ? null
                    : STRUCTURES.find((s) => s.code === sk)?.label ?? sk;

                return (
                  <div
                    key={key}
                    className="rounded border p-3 text-sm bg-white"
                  >
                    <div className="text-gray-600 mb-1 flex items-center gap-2">
                      <span>{r.question_label ?? "(fără titlu)"} </span>
                      {structure === "all" && structLabel && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border">
                          {structLabel}
                        </span>
                      )}
                    </div>
                    <div className="font-medium">
                      {r.value_text ?? <em className="text-gray-400">(gol)</em>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ===================== Componente auxiliare (server) ===================== */

function fmtNumber(v: number | null) {
  return v == null ? "—" : Number(v).toLocaleString("ro-RO");
}

function groupBy<T>(arr: T[], keyFn: (x: T) => string) {
  const m: Record<string, T[]> = {};
  for (const x of arr) {
    const k = keyFn(x);
    (m[k] = m[k] ?? []).push(x);
  }
  return m;
}

function indexFromLabel(label: string) {
  const m = label.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

function Empty({ notice }: { notice: string }) {
  return (
    <div className="text-sm text-gray-500 border rounded p-3 bg-gray-50">
      {notice}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-3">
      <div className="text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

/* Bară procentuală – evidențiem „corect” cu o culoare mai puternică */
function BarCell({ pct, highlight }: { pct: number; highlight?: boolean }) {
  const w = Math.max(0, Math.min(100, pct));
  const barClass = highlight ? "bg-emerald-600" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 bg-gray-200 rounded overflow-hidden">
        <div
          className={`h-2 ${barClass}`}
          style={{ width: `${w}%` }}
          aria-hidden
        />
      </div>
      <span className="tabular-nums">{w.toFixed(2)}%</span>
    </div>
  );
}

/* Selector structuri – schimbă query param-ul `structure` */
function StructurePicker({
  quizId,
  active,
}: {
  quizId: string;
  active: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-600">Structură:</span>
      <div className="flex flex-wrap gap-1">
        {STRUCTURES.map((s) => {
          const href =
            s.code === "all"
              ? `/admin/quizzes/${quizId}/analytics`
              : `/admin/quizzes/${quizId}/analytics?structure=${encodeURIComponent(
                  s.code
                )}`;
          const isActive = active === s.code;
          return (
            <Link
              key={s.code}
              href={href}
              className={
                "px-2 py-1 rounded border " +
                (isActive
                  ? "bg-black text-white border-black"
                  : "hover:bg-gray-100")
              }
            >
              {s.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
