export type QType = "single" | "multiple";

export function validateQuestion(params: {
  label: string;
  qtype: QType;
  options: Array<{ text: string; correct: boolean }>;
}) {
  const errors: string[] = [];

  const label = params.label?.trim();
  if (!label) errors.push("Titlul întrebării este obligatoriu.");

  const opts = params.options ?? [];
  const nonEmpty = opts.filter((o) => o.text?.trim().length > 0);
  if (nonEmpty.length === 0) {
    errors.push("Adaugă cel puțin o opțiune.");
  }

  const correctCount = nonEmpty.filter((o) => o.correct).length;

  if (params.qtype === "single") {
    if (correctCount !== 1) {
      errors.push(
        "Pentru tipul „single” trebuie să existe exact o opțiune corectă."
      );
    }
  } else if (params.qtype === "multiple") {
    if (correctCount < 1) {
      errors.push(
        "Pentru tipul „multiple” trebuie să existe cel puțin o opțiune corectă."
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
