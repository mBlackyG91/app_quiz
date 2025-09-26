import { notFound } from "next/navigation";
import { createServer } from "@/lib/supabase-server";
import QuizEditor from "./quiz-editor";

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

export default async function EditQuiz({ params }: { params: { id: string } }) {
  const supabase = await createServer();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,description,is_published")
    .eq("id", params.id)
    .single();

  if (!quiz) return notFound();

  const { data: questionsRes } = await supabase
    .from("questions")
    .select("id,label,qtype,required,order")
    .eq("quiz_id", params.id)
    .order("order");

  const questions = (questionsRes ?? []) as Question[];

  let options: Option[] = [];
  if (questions.length) {
    const qids = questions.map((q) => q.id);
    const { data: optsRes } = await supabase
      .from("options")
      .select("id,question_id,text,value,order")
      .in("question_id", qids)
      .order("order");
    options = (optsRes ?? []) as Option[];
  }

  return (
    <QuizEditor quiz={quiz as Quiz} questions={questions} options={options} />
  );
}
