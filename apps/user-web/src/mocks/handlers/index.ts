import { http, HttpResponse, delay } from "msw";
import { mockApi } from "@/lib/api/mock-service";
import { endpoints } from "@/lib/api/endpoints";

export const handlers = [
  http.post(endpoints.login, async ({ request }) => { await delay(300); const body = await request.json() as { email: string; password: string }; try { return HttpResponse.json({ data: await mockApi.login(body.email, body.password) }); } catch (error) { const message = error instanceof Error ? error.message : "Login failed"; return HttpResponse.json({ error: { code: "UNAUTHENTICATED", message } }, { status: 401 }); } }),
  http.get(endpoints.dashboard, async () => HttpResponse.json({ data: await mockApi.dashboard() })),
  http.get(endpoints.courses, async ({ request }) => HttpResponse.json({ data: await mockApi.listCourses(new URL(request.url).searchParams.get("search") ?? "") })),
];
