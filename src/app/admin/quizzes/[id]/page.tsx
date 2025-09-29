// src/app/admin/quizzes/[id]/page.tsx
import QuizEditor from "./quiz-editor";
import { createServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  // în Next 15 params e un Promise
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // IMPORTANT: createServer() returnează Promise<SupabaseClient>,
  // deci îl așteptăm aici.
  // Dacă în proiectul tău createServer() returnează direct clientul,
  // scoate "await".
  const supabase = await createServer();

  // verificăm că quiz-ul există înainte de a încărca editorul
  const { data: quiz, error } = await supabase
    .from("quizzes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error || !quiz) {
    // întoarcem utilizatorul la listă cu un mesaj
    redirect("/admin/quizzes?msg=notfound");
  }

  return <QuizEditor quizId={id} />;
}
