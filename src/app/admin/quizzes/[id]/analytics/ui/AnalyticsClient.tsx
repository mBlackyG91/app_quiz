"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Structure = { code: string; name: string };

type OptRow = {
  quiz_id: string;
  structure_code: string | null;
  question_id: string;
  question_label: string | null;
  option_id: string | null;
  option_text: string | null;
  option_count: number;
};
type NumRow = {
  quiz_id: string;
  structure_code: string | null;
  question_id: string;
  question_label: string | null;
  n: number;
  avg: number | null;
  min: number | null;
  max: number | null;
};
type TextRow = {
  quiz_id: string;
  structure_code: string | null;
  question_id: string;
  question_label: string | null;
  value_text: string | null;
  created_at: string;
};
type ScoreRow = {
  quiz_id: string;
  structure_code: string | null;
  submission_id: string;
  user_id: string | null;
  created_at: string;
  gradable_count: number | null;
  correct_count: number | null;
  score_pct: number | null;
};
type ScoreSummary = {
  quiz_id: string;
  structure_code: string | null;
  submissions_count: number;
  avg_score_pct: number | null;
};

export default function AnalyticsClient({
  quizId,
  structures,
  selectedStructure,
  optionRows,
  numericRows,
  textRows,
  scoreRows,
  scoreSummary,
}: {
  quizId: string;
  structures: Structure[];
  selectedStructure: string; // "all" sau code
  optionRows: OptRow[];
  numericRows: NumRow[];
  textRows: TextRow[];
  scoreRows: ScoreRow[];
  scoreSummary: ScoreSummary | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChangeStructure = (code: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (code === "all") params.delete("structure");
    else params.set("structure", code);
    router.push(`${pathname}?${params.toString()}`);
  };

  /* ====== Distribuții pe opțiuni ====== */
  const byQuestion = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        options: { option: string; count: number }[];
        total: number;
      }
    >();
    for (const r of optionRows) {
      const qid = r.question_id;
      const label = r.question_label ?? "(fără titlu)";
      const optText = (r.option_text ?? "(fără text)").trim();
      if (!map.has(qid)) map.set(qid, { label, options: [], total: 0 });
      const bucket = map.get(qid)!;
      bucket.options.push({ option: optText, count: r.option_count || 0 });
      bucket.total += r.option_count || 0;
    }
    return Array.from(map.entries()).map(([qid, v]) => ({
      question_id: qid,
      label: v.label,
      total: v.total,
      data: v.options
        .sort((a, b) => b.count - a.count)
        .map((o) => ({ name: o.option, count: o.count })),
    }));
  }, [optionRows]);

  /* ====== Statistici numerice ====== */
  const numeric = useMemo(
    () => [...numericRows].sort((a, b) => (b.n || 0) - (a.n || 0)),
    [numericRows]
  );

  /* ====== Text latest ====== */
  const [textLimit, setTextLimit] = useState(50);
  const textLatest = useMemo(() => {
    const arr = [...textRows].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
    );
    return arr.slice(0, textLimit);
  }, [textRows, textLimit]);

  /* ====== Scoruri ====== */
  const scores = useMemo(
    () =>
      scoreRows
        .map((s) => s.score_pct)
        .filter((v): v is number => typeof v === "number"),
    [scoreRows]
  );

  const kpi = {
    submissions: scoreSummary?.submissions_count ?? 0,
    avgScore: scoreSummary?.avg_score_pct ?? null,
  };

  // histogramă 0..100 (bin 10p)
  const bins = useMemo(() => {
    const binSize = 10;
    const bucket = new Map<string, number>();
    for (const v of scores) {
      const b = Math.min(99, Math.max(0, Math.floor(v)));
      const start = Math.floor(b / binSize) * binSize;
      const end = start + binSize;
      const key = `${start}-${end}`;
      bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    return Array.from(bucket.entries())
      .map(([range, count]) => ({ range, count }))
      .sort((a, b) => parseInt(a.range) - parseInt(b.range));
  }, [scores]);

  return (
    <div className="p-4 space-y-8">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-gray-500 text-sm">Quiz ID: {quizId}</p>
        </div>

        {/* Selector structură */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Structură:</label>
          <select
            className="border rounded px-2 py-1"
            value={selectedStructure}
            onChange={(e) => handleChangeStructure(e.target.value)}
          >
            <option value="all">Toate</option>
            {structures.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* KPI + histogramă */}
      <section className="grid sm:grid-cols-3 gap-3">
        <div className="border rounded p-4">
          <div className="text-xs text-gray-500">Completări</div>
          <div className="text-2xl font-semibold">{kpi.submissions}</div>
        </div>
        <div className="border rounded p-4 sm:col-span-2">
          <div className="text-xs text-gray-500">
            Scor mediu (grad cunoaștere)
          </div>
          <div className="text-2xl font-semibold">
            {kpi.avgScore != null ? `${kpi.avgScore}%` : "—"}
          </div>
          <div className="h-28 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bins}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Distribuții pe opțiuni */}
      <section>
        <h2 className="text-lg font-medium mb-3">
          Distribuții răspunsuri (single/multiple)
        </h2>
        {byQuestion.length === 0 ? (
          <div className="text-sm text-gray-500">
            Nu există răspunsuri pentru întrebări de tip opțiuni.
          </div>
        ) : (
          <div className="space-y-8">
            {byQuestion.map((q) => (
              <div key={q.question_id} className="border rounded p-3">
                <div className="mb-2">
                  <div className="font-medium">{q.label}</div>
                  <div className="text-xs text-gray-500">
                    Total răspunsuri: {q.total}
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={q.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Statistici numerice */}
      <section>
        <h2 className="text-lg font-medium mb-3">Statistici numerice</h2>
        {numeric.length === 0 ? (
          <div className="text-sm text-gray-500">
            Nu există răspunsuri pentru întrebări numerice.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {numeric.map((r) => (
              <div key={r.question_id} className="border rounded p-3">
                <div className="font-medium mb-1">
                  {r.question_label ?? "(fără titlu)"}
                </div>
                <div className="text-sm">
                  <div>
                    <span className="text-gray-500">N:</span> {r.n}
                  </div>
                  <div>
                    <span className="text-gray-500">AVG:</span> {r.avg ?? "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">MIN:</span> {r.min ?? "-"}
                  </div>
                  <div>
                    <span className="text-gray-500">MAX:</span> {r.max ?? "-"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Răspunsuri text */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Ultimele răspunsuri text</h2>
          <div className="text-sm">
            Afișează
            <select
              className="ml-2 border rounded px-2 py-1"
              value={textLimit}
              onChange={(e) => setTextLimit(Number(e.target.value))}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {textLatest.length === 0 ? (
          <div className="text-sm text-gray-500">
            Nu există răspunsuri text de afișat.
          </div>
        ) : (
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 w-[36%]">Întrebare</th>
                  <th className="text-left p-2">Răspuns</th>
                  <th className="text-left p-2 w-[16%]">Data</th>
                </tr>
              </thead>
              <tbody>
                {textLatest.map((r, i) => (
                  <tr key={`${r.question_id}-${i}`} className="border-t">
                    <td className="p-2">
                      {r.question_label ?? "(fără titlu)"}
                    </td>
                    <td className="p-2 whitespace-pre-wrap">
                      {r.value_text ?? ""}
                    </td>
                    <td className="p-2 text-gray-500">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
