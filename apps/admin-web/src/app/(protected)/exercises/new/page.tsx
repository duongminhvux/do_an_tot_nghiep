import { ExerciseWizard } from "@/features/exercises/exercise-wizard";
export default async function Page({searchParams}:{searchParams:Promise<{step?:string}>}){const p=await searchParams;return <ExerciseWizard initialStep={p.step}/>}
