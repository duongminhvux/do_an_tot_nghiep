import { setTimeout as delay } from "node:timers/promises";
import type { Row } from "./generator.ts";
export async function request(
  path: string,
  token?: string,
  body?: Row,
  method = body ? "POST" : "GET",
) {
  const base = process.env.DEMO_GATEWAY_URL ?? "http://127.0.0.1:5000";
  const url = new URL(base);
  if (!["127.0.0.1", "localhost", "gateway"].includes(url.hostname))
    throw new Error("Demo API calls require local gateway");
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(180000),
  });
  const json = (await response.json()) as Row;
  if (!response.ok)
    throw new Error(
      `API ${method} ${path}: HTTP ${response.status} ${JSON.stringify(json.message ?? json.error ?? "failed")}`,
    );
  return json.data ?? json;
}
export async function adminLogin() {
  const password =
    process.env.DEMO_ADMIN_PASSWORD ?? process.env.DEFAULT_ADMIN_PASSWORD;
  if (!password)
    throw new Error(
      "Set DEMO_ADMIN_PASSWORD to an existing authorized admin password",
    );
  const result = await request("/admin/auth/login", undefined, {
    email:
      process.env.DEMO_ADMIN_EMAIL ??
      process.env.DEFAULT_ADMIN_EMAIL ??
      "admin@gmail.com",
    password,
  });
  return result.accessToken as string;
}
/** A few reusable lessons only; every media job goes through the existing admin workflow. */
export async function prepareContent() {
  const token = await adminLogin();
  const topics = await request("/admin/dictation/hierarchy", token);
  const topicList = Array.isArray(topics) ? topics : (topics.topics ?? []);
  let topic = topicList.find((t: Row) => t.slug === "synthetic-demo-practice");
  if (!topic)
    topic = await request("/admin/dictation/topics", token, {
      title: "Synthetic Demo Practice",
      slug: "synthetic-demo-practice",
      description:
        "Reusable listening content for the synthetic demonstration.",
      isActive: true,
    });
  const topicId = topic._id ?? topic.id;
  const hierarchy = await request("/admin/dictation/hierarchy", token);
  const allSections = Array.isArray(hierarchy)
    ? hierarchy.flatMap((t: Row) => t.sections ?? [])
    : (hierarchy.sections ??
      (hierarchy.topics ?? []).flatMap((t: Row) => t.sections ?? []));
  let section = allSections.find(
    (s: Row) =>
      String(s.topicId?._id ?? s.topicId) === topicId &&
      s.slug === "demo-practice",
  );
  if (!section)
    section = await request("/admin/dictation/sections", token, {
      topicId,
      title: "Demo practice",
      slug: "demo-practice",
      isActive: true,
    });
  const sectionId = section._id ?? section.id;
  const texts = [
    [
      "Daily study habits",
      "I study English every morning. My friend helps me practise new words. We review our notes after lunch.",
    ],
    [
      "At the office",
      "The meeting starts at nine tomorrow. Please bring the updated report. We will discuss the new project together.",
    ],
    [
      "Weekend plans",
      "We are going to visit the library. The weather will be sunny this weekend. I would like to borrow an English book.",
    ],
  ];
  for (let i = 0; i < texts.length; i++) {
    const slug = `synthetic-demo-listening-${i + 1}`;
    const list = await request(
      "/admin/dictation?search=" + encodeURIComponent(texts[i]![0]!),
      token,
    );
    const items = Array.isArray(list)
      ? list
      : (list.items ?? list.results ?? []);
    let lesson = items.find((l: Row) => l.slug === slug);
    if (!lesson)
      lesson = await request("/admin/dictation", token, {
        title: texts[i]![0]!,
        slug,
        description:
          "Synthetic demo reusable content; retained by demo cleanup.",
        level: "A2",
        topicId,
        sectionId,
        sourceText: texts[i]![1]!,
        audioSource: "TTS",
        language: "en-US",
        voiceIds: ["af_heart"],
        speed: 1,
        pauseAfterMs: 300,
      });
    const id = lesson._id ?? lesson.id;
    let detail = await request(`/admin/dictation/${id}`, token);
    detail = detail.lesson ?? detail;
    if (
      detail.publicationStatus === "PUBLISHED" &&
      detail.status === "PUBLISHED"
    ) {
      console.log(
        JSON.stringify({ preparedDictation: slug, id, reused: true }),
      );
      continue;
    }
    if (detail.status !== "PUBLISHED" && detail.status !== "READY")
      await request(`/admin/dictation/${id}/generate-audio`, token, {});
    for (let n = 0; n < 90; n++) {
      let result = await request(`/admin/dictation/${id}`, token);
      result = result.lesson ?? result;
      if (["FAILED", "ERROR", "AUDIO_FAILED"].includes(result.status))
        throw new Error(`Dictation generation failed for ${slug}`);
      if (["READY", "PUBLISHED"].includes(result.status)) break;
      if (n === 89) throw new Error(`Dictation generation timeout for ${slug}`);
      await delay(2000);
    }
    await request(`/admin/dictation/${id}/validate`, token, {});
    await request(`/admin/dictation/${id}/publish`, token, {});
    console.log(JSON.stringify({ preparedDictation: slug, id }));
  }
}
export async function verifyApi() {
  if (!process.env.DEMO_LOGIN_PASSWORD)
    throw new Error(
      "DEMO_LOGIN_PASSWORD required for authenticated user API verification",
    );
  const login = await request("/auth/login", undefined, {
    email: "demo.user0001@example.com",
    password: process.env.DEMO_LOGIN_PASSWORD,
  });
  const routes = [
    "/auth/me",
    "/attempts?limit=10",
    "/attempts/stats",
    "/learning/vocabulary",
    "/reviews/stats",
    "/dictation/progress",
    "/arena/profile",
    "/arena/leaderboard?period=all&limit=10",
    "/arena/matches",
  ];
  const result: Row = {};
  for (const route of routes) {
    const data = await request(route, login.accessToken);
    if (data === null) throw new Error(`Empty API ${route}`);
    result[route] = data;
  }
  const token = await adminLogin();
  result["/admin/users"] = await request(
    "/admin/users?limit=10&search=demo.user",
    token,
  );
  result["/admin/dashboard/overview"] = await request(
    "/admin/dashboard/overview?days=90",
    token,
  );
  const ensure = (condition: unknown, message: string) => {
    if (!condition) throw new Error(`API verification: ${message}`);
  };
  ensure(
    result["/auth/me"].email === "demo.user0001@example.com",
    "wrong authenticated learner",
  );
  ensure(result["/attempts?limit=10"].length > 0, "TOEIC history empty");
  ensure(
    result["/attempts/stats"].totalCompleted > 0,
    "TOEIC completed statistics empty",
  );
  ensure(
    result["/learning/vocabulary"].length > 0 &&
      result["/reviews/stats"].totalWords > 0,
    "vocabulary progress empty",
  );
  ensure(
    result["/dictation/progress"].totalStarted > 0,
    "Dictation progress empty",
  );
  ensure(
    result["/arena/leaderboard?period=all&limit=10"].players.length > 0,
    "Arena leaderboard empty",
  );
  ensure(result["/arena/matches"].length > 0, "Arena history empty");
  ensure(
    result["/admin/users"].total > 0 && result["/admin/users"].items.length > 0,
    "admin user search empty",
  );
  ensure(
    result["/admin/dashboard/overview"].stats.users > 0 &&
      result["/admin/dashboard/overview"].stats.attempts > 0,
    "admin statistics empty",
  );
  return Object.fromEntries(
    Object.entries(result).map(([route, data]) => [
      route,
      {
        passed: true,
        ...(Array.isArray(data) ? { items: data.length } : {}),
        ...Object.fromEntries(
          [
            "total",
            "totalCompleted",
            "totalWords",
            "totalStarted",
            "totalPlayers",
            "rating",
          ]
            .filter((k) => typeof data[k] === "number")
            .map((k) => [k, data[k]]),
        ),
        ...(route === "/admin/dashboard/overview" ? { stats: data.stats } : {}),
      },
    ]),
  );
}
