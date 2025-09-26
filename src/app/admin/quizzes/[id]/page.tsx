// src/app/admin/quizzes/[id]/page.tsx
import QuizEditor from "./quiz-editor";

// În Next 15, params este un Promise.
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QuizEditor quizId={id} />;
}
