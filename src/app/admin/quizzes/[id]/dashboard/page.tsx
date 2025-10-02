import Link from "next/link";
import { createServer } from "@/lib/supabase-server";

// mic helper pt query params
function qp(u: URL, next: Record<string, string | null | undefined>) {
  const url = new URL(u);
  Object.entries(next).forEach(([k, v]) => {
    if (v == null || v === "") url.searchParams.delete(k);
    else url.searchParams.set(k, String(v));
  });
  return url.toString();
}

type PageProps = {
  params: { id: string };
  searchParams?: { structure?: string; from?: string; to?: string };
};

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

export default async function Page({ params, searchParams }: PageProps) {
  const supabase = await createServer();
  const structure = (searchParams?.structure ?? "all").toLowerCase();
  const from = searchParams?.from ?? "";
  const to = searchParams?.to ?? "";

  // 1) Titlul chestionarului
  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .select("id,title")
    .eq("id", params.id)
    .maybeSingle();
  if (quizErr || !quiz) throw new Error(quizErr?.message ?? "Quiz not found");

  // 2) Submisii în interval (pe structuri)
  //    Folosim submissions (direct) pentru a avea submitted_at și structure_code.
  let subQ = supabase
    .from("submissions")
    .select("id, structure_code, submitted_at, quiz_id")
    .eq("quiz_id", params.id);

  if (structure !== "all") subQ = subQ.eq("structure_code", structure);
  if (from) subQ = subQ.gte("submitted_at", `${from}T00:00:00Z`);
  if (to) subQ = subQ.lte("submitted_at", `${to}T23:59:59.999Z`);

  const { data: subs, error: subsErr } = await subQ;
  if (subsErr) throw new Error(subsErr.message);

  const submissionsCount = subs?.length ?? 0;
  const submissionsByStruct = (subs ?? []).reduce<Record<string, number>>(
    (acc, s) => {
      const k = s.structure_code ?? "(necunoscut)";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {}
  );

  // 3) Media scor (%) — din view-ul analytics_quiz_scores (pe toate datele).
  //    (Dacă vrei strict pe interval, facem o versiune 2 cu join la submissions.)
  const { data: scores, error: scoresErr } = await supabase
    .from("analytics_quiz_scores")
    .select("structure_code, score_pct, submission_id")
    .eq("quiz_id", params.id);

  if (scoresErr) throw new Error(scoresErr.message);

  const numericScores = (scores ?? [])
    .map((s) => s.score_pct)
    .filter((x): x is number => typeof x === "number");
  const avgScore =
    numericScores.length > 0
      ? Number(
          (
            numericScores.reduce((a, b) => a + b, 0) / numericScores.length
          ).toFixed(2)
        )
      : null;

  // media pe structură (general)
  const avgScoreByStruct = (scores ?? []).reduce<
    Record<string, { sum: number; n: number }>
  >((acc, s) => {
    if (typeof s.score_pct !== "number") return acc;
    const k = s.structure_code ?? "(necunoscut)";
    const r = acc[k] ?? { sum: 0, n: 0 };
    r.sum += s.score_pct;
    r.n += 1;
    acc[k] = r;
    return acc;
  }, {});
  const avgScoreByStructComputed = Object.fromEntries(
    Object.entries(avgScoreByStruct).map(([k, v]) => [
      k,
      Number((v.sum / v.n).toFixed(2)),
    ])
  );

  // structuri de afișat: ordonăm după label
  function labelFor(code: string | null) {
    if (!code) return "(necunoscut)";
    return STRUCTURES.find((s) => s.code === code)?.label ?? code;
  }

  // URL de bază pentru navigare și export
  const base = new URL(
    `/admin/quizzes/${encodeURIComponent(quiz.id)}/dashboard`,
    "http://local"
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">
          Dashboard — {quiz.title} ·{" "}
          <span className="text-gray-500">
            {labelFor(structure === "all" ? null : structure)}
          </span>
        </h1>
        <Link
          href={`/admin/quizzes/${quiz.id}`}
          className="ml-auto text-sm text-blue-600 hover:underline"
        >
          ← Înapoi la chestionar
        </Link>
      </div>

      {/* Filtre */}
      <section className="border rounded-md p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* structure */}
          <div className="flex flex-col">
            <label className="text-xs text-gray-600">Structură</label>
            <div className="flex flex-wrap gap-2">
              {STRUCTURES.map((s) => {
                const href = qp(base, {
                  structure: s.code === "all" ? null : s.code,
                  from,
                  to,
                }).replace("http://local", "");
                const active = s.code === structure;
                return (
                  <Link
                    key={s.code}
                    href={href}
                    className={
                      "px-2 py-1 rounded border text-sm " +
                      (active
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

          {/* interval */}
          <form
            action={qp(base, { structure, from, to }).replace(
              "http://local",
              ""
            )}
            className="flex items-end gap-2"
          >
            <div>
              <label className="text-xs text-gray-600">De la</label>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Până la</label>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <input type="hidden" name="structure" value={structure} />
            <button
              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
              formMethod="get"
            >
              Aplică filtre
            </button>

            {/* Export answers CSV */}
            <a
              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm"
              href={qp(new URL("/api/analytics/export", "http://local"), {
                quizId: quiz.id,
                structure: structure === "all" ? null : structure,
                from: from || null,
                to: to || null,
              }).replace("http://local", "")}
            >
              Export CSV (răspunsuri)
            </a>
          </form>
        </div>
      </section>

      {/* Rezumat */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-3">Rezumat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <StatBox label="Submisii (în interval)" value={submissionsCount} />
          <StatBox
            label="Media scor (%) – total"
            value={avgScore != null ? `${avgScore}` : "—"}
          />
          <StatBox
            label="Structură selectată"
            value={labelFor(structure === "all" ? null : structure)}
          />
        </div>
      </section>

      {/* Comparativ pe structuri */}
      <section className="border rounded-md p-4">
        <h2 className="font-medium mb-3">Structuri – comparație</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left bg-gray-50">
                <th className="px-3 py-2">Structură</th>
                <th className="px-3 py-2">Submisii (în interval)</th>
                <th className="px-3 py-2">Media scor (%) – total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(
                // vrem toate structurile cunoscute, chiar dacă 0
                STRUCTURES.reduce<Record<string, true>>((acc, s) => {
                  acc[s.code] = true;
                  return acc;
                }, {})
              )
                .map(([code]) => code)
                .filter((code) => code !== "all")
                .map((code) => {
                  const label = labelFor(code);
                  const n = submissionsByStruct[code] ?? 0;
                  const avg = avgScoreByStructComputed[code] ?? null;
                  return (
                    <tr key={code} className="border-t">
                      <td className="px-3 py-2">{label}</td>
                      <td className="px-3 py-2">
                        <BarCell pct={n} max={Math.max(1, submissionsCount)} />
                        <span className="ml-2 tabular-nums">{n}</span>
                      </td>
                      <td className="px-3 py-2">
                        {avg == null ? (
                          "—"
                        ) : (
                          <div className="flex items-center">
                            <BarCell pct={avg} max={100} />
                            <span className="ml-2 tabular-nums">
                              {avg.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-3 bg-white">
      <div className="text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// bar simplu (folosit atât pentru %, cât și pentru „n / max”)
function BarCell({ pct, max }: { pct: number; max: number }) {
  const w = Math.max(0, Math.min(100, (pct / max) * 100));
  return (
    <div className="h-2 w-40 bg-gray-200 rounded overflow-hidden">
      <div className="h-2 bg-slate-500" style={{ width: `${w}%` }} />
    </div>
  );
}
