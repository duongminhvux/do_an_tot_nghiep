import { LoginPage } from "@/features/auth/login-page";
export default async function Page({searchParams}:{searchParams:Promise<{next?:string}>}){const params=await searchParams;return <LoginPage next={params.next}/>}
