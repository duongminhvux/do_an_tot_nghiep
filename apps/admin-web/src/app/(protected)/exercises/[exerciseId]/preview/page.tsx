import { ExerciseWizard } from "@/features/exercises/exercise-wizard";
export default async function Page({params}:{params:Promise<{exerciseId:string}>}){return <ExerciseWizard id={(await params).exerciseId} previewOnly/>}
