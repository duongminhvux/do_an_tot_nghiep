import { ResultPage } from "@/features/exercises/result-page";
export default async function Page({ params }: { params: Promise<{ exerciseId: string; attemptId: string }> }) { const p = await params; return <ResultPage exerciseId={p.exerciseId} attemptId={p.attemptId} />; }
