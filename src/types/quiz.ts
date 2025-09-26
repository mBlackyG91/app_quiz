// src/types/quiz.ts
export type QType = "single" | "multiple" | "text" | "number";

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  is_published: boolean;
}

export interface Question {
  id: string;
  label: string;
  qtype: QType;
  required: boolean;
  order: number;
}

export interface Option {
  id: string;
  question_id: string;
  text: string | null;
  value: string | null;
  order: number;
}
