// src/app/admin/quizzes/[id]/page.tsx
import QuizEditor from "./quiz-editor";
import { createServer } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

// gardă simplă pentru UUID v4 (e ok și pentru v1/v5 dacă vrei să relaxezi regexul)
function isUUID(v: string | undefined): v is string {
  return (
    !!v &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isUUID(id)) {
    redirect("/admin/quizzes?msg=notfound");
  }

  const supabase = await createServer();

  // verificăm că quiz-ul există înainte de a încărca editorul
  const { data: quiz, error } = await supabase
    .from("quizzes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error || !quiz) {
    redirect("/admin/quizzes?msg=notfound");
  }

  return <QuizEditor quizId={id} />;
}
