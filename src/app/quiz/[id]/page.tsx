import { notFound } from "next/navigation";
import { createServer } from "@/lib/supabase-server";
import QuizRunner from "./runner";
import type { Quiz, Question, Option } from "@/types/quiz";

export default async function QuizPage({ params }: { params: { id: string } }) {
  const supabase = await createServer();

  // --- aflăm user & rol (ca să lăsăm adminul să vadă draft-uri)
  const { data: { user } = {} } = await supabase.auth.getUser();
  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  // --- quiz (adminul vede oricum; restul doar dacă e publicat)
  const base = supabase
    .from("quizzes")
    .select("id,title,description,is_published")
    .eq("id", params.id);

  const quizQuery = isAdmin ? base : base.eq("is_published", true);

  const { data: quiz, error: quizErr } = await quizQuery.single<Quiz>();

  if (quizErr || !quiz) {
    notFound();
  }

  // --- întrebări
  const { data: questions = [] } = await supabase
    .from("questions")
    .select("id,label,qtype,required,order")
    .eq("quiz_id", params.id)
    .order("order");

  // --- opțiuni doar pentru întrebările care au
  const qids = (questions ?? []).map((q) => q.id);
  let options: Option[] = [];

  if (qids.length > 0) {
    const { data = [] } = await supabase
      .from("options")
      .select("id,question_id,text,value,order")
      .in("question_id", qids)
      .order("order");

    options = data as Option[];
  }

  return (
    <QuizRunner
      quiz={quiz as Quiz}
      questions={(questions ?? []) as Question[]}
      options={options}
    />
  );
}
