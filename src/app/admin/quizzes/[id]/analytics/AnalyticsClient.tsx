"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowser } from "@/lib/supabase-browser";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type OptionCount = {
  quiz_id: string;
  question_id: string;
  question_label: string;
  qtype: "single" | "multiple";
  option_id: string;
  option_text: string;
  cnt: number;
};

type NumStats = {
  quiz_id: string;
  question_id: string;
  question_label: string;
  avg_value: number | null;
  min_value: number | null;
  max_value: number | null;
  n: number;
};

type TextLatest = {
  quiz_id: string;
  question_id: string;
  question_label: string;
  value_text: string | null;
  created_at: string;
};

export default function AnalyticsClient({ quizId }: { quizId: string }) {
  // creez clientul o singură dată -> nu mai apare warning-ul de deps în useEffect
  const supabase = useMemo(() => createBrowser(), []);

  const [optCounts, setOptCounts] = useState<OptionCount[] | null>(null);
  const [numStats, setNumStats] = useState<NumStats[] | null>(null);
  const [textLatest, setTextLatest] = useState<TextLatest[] | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: oc }, { data: ns }, { data: tl }] = await Promise.all([
        supabase
          .from("analytics_option_counts")
          .select("*")
          .eq("quiz_id", quizId),
        supabase
          .from("analytics_numeric_stats")
          .select("*")
          .eq("quiz_id", quizId),
        supabase
          .from("analytics_text_latest")
          .select("*")
          .eq("quiz_id", quizId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      setOptCounts((oc ?? []) as OptionCount[]);
      setNumStats((ns ?? []) as NumStats[]);
      setTextLatest((tl ?? []) as TextLatest[]);
    })();
  }, [quizId, supabase]);

  if (optCounts === null || numStats === null || textLatest === null) {
    return <div style={{ padding: 24 }}>Se încarcă analytics…</div>;
  }

  // grupare pentru întrebările single/multiple
  const groups = optCounts.reduce<Record<string, OptionCount[]>>((acc, r) => {
    (acc[r.question_id] ||= []).push(r);
    return acc;
  }, {});

  const hasAny =
    Object.keys(groups).length > 0 ||
    (numStats?.length ?? 0) > 0 ||
    (textLatest?.length ?? 0) > 0;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Analytics</h1>
      <p style={{ opacity: 0.7, marginBottom: 16 }}>
        Vizualizări pentru chestionarul #{quizId}
      </p>

      {!hasAny && (
        <div
          style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}
        >
          Nu există încă date de analiză pentru acest chestionar.
        </div>
      )}

      {Object.entries(groups).map(([qid, rows]) => (
        <div key={qid} style={{ marginBottom: 32 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>
            {rows[0]?.question_label}
          </h3>
          <div
            style={{
              height: 280,
              background: "#fafafa",
              border: "1px solid #eee",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              {rows[0]?.qtype === "single" ? (
                <BarChart
                  data={rows.map((r) => ({
                    name: r.option_text,
                    count: r.cnt,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              ) : (
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie
                    data={rows.map((r) => ({
                      name: r.option_text,
                      value: r.cnt,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={110}
                  >
                    {rows.map((_, i) => (
                      <Cell key={i} />
                    ))}
                  </Pie>
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      ))}

      {numStats.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Întrebări numerice
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {numStats.map((s) => (
              <div
                key={s.question_id}
                style={{
                  padding: 12,
                  border: "1px solid #eee",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {s.question_label}
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <Stat label="Medie" value={s.avg_value ?? 0} />
                  <Stat label="Min" value={s.min_value ?? 0} />
                  <Stat label="Max" value={s.max_value ?? 0} />
                  <Stat label="N" value={s.n} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {textLatest.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Răspunsuri text (ultimele 100)
          </h2>
          <div style={{ display: "grid", gap: 8 }}>
            {textLatest.map((t, i) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  border: "1px solid #eee",
                  borderRadius: 10,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {t.question_label}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{t.value_text}</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                  {new Date(t.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: 8, border: "1px solid #eee", borderRadius: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}
