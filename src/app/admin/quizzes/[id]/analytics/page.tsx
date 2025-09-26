import AnalyticsClient from "./AnalyticsClient";

export default function Page({ params }: { params: { id: string } }) {
  return <AnalyticsClient quizId={params.id} />;
}
