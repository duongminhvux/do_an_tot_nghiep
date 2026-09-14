import { ExercisePage } from "@/features/exercises/exercise-page";
export default async function Page({ params }: { params: Promise<{ exerciseId: string }> }) { return <ExercisePage exerciseId={(await params).exerciseId} />; }
