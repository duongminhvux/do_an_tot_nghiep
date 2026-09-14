import { AuthLayout } from "@/features/auth/auth-layout";
import { LoginForm } from "@/features/auth/login-form";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const params = await searchParams; return <AuthLayout title="Welcome back" subtitle="Continue your English listening journey."><LoginForm next={params.next} /></AuthLayout>; }
