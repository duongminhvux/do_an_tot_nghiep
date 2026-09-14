import { ExerciseWizard } from "@/features/exercises/exercise-wizard";
export default async function Page({params,searchParams}:{params:Promise<{exerciseId:string}>;searchParams:Promise<{step?:string}>}){const [p,q]=await Promise.all([params,searchParams]);return <ExerciseWizard id={p.exerciseId} initialStep={q.step}/>}
