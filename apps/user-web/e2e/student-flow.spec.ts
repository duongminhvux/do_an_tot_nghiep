import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiBase = "http://localhost:4000/api/v1";
const password = "Playwright123!";
let email = "";
let courseSlug = "";
let lessonSlug = "";
let dictationId = "";
let toeicId = "";

const wav = () => {
  const sampleRate = 8_000;
  const samples = sampleRate / 2;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
};

async function json<T>(
  request: APIRequestContext,
  method: "get" | "post" | "put" | "patch",
  path: string,
  token?: string,
  data?: unknown,
) {
  const response = await request[method](`${apiBase}/${path}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${await response.text()}`).toBeTruthy();
  return response.json() as Promise<T>;
}

test.beforeAll(async ({ request }) => {
  const stamp = Date.now();
  email = `playwright-${stamp}@example.test`;
  courseSlug = `playwright-course-${stamp}`;
  lessonSlug = "listening-practice";
  const admin = await json<{ accessToken: string }>(request, "post", "auth/login", undefined, {
    email: "admin@listenup-admin.test",
    password: "Admin123!",
    clientType: "ADMIN_WEB",
  });
  await json(request, "post", "auth/register", undefined, {
    email,
    fullName: "Playwright Student",
    password,
    targetLevel: "INTERMEDIATE",
    learningGoal: "Validate the real student flow",
  });
  const course = await json<{ id: string }>(request, "post", "admin/courses", admin.accessToken, {
    title: `Playwright Listening ${stamp}`,
    slug: courseSlug,
    description: "A real API course created by the Playwright setup.",
    level: "INTERMEDIATE",
    category: "Testing",
    visibility: "PUBLIC",
    orderIndex: 90,
  });
  const lesson = await json<{ id: string }>(
    request,
    "post",
    `admin/courses/${course.id}/lessons`,
    admin.accessToken,
    {
      title: "Listening Practice",
      slug: lessonSlug,
      description: "Practice real audio and persisted answers.",
      content: { overview: "Playwright-backed lesson" },
      estimatedDurationMinutes: 10,
      orderIndex: 0,
    },
  );
  await json(
    request,
    "put",
    `admin/courses/${course.id}/lessons/${lesson.id}/draft`,
    admin.accessToken,
    {
      title: "Listening Practice",
      slug: lessonSlug,
      description: "Practice real audio and persisted answers.",
      content: { overview: "Playwright-backed lesson" },
      estimatedDurationMinutes: 10,
      orderIndex: 0,
      vocabulary: [{ word: "progress", meaning: "forward improvement", example: "Practice makes progress." }],
      expressions: [],
      resources: [],
    },
  );
  const dictation = await json<{ id: string }>(
    request,
    "post",
    "admin/exercises",
    admin.accessToken,
    {
      lessonId: lesson.id,
      title: "Playwright Dictation",
      instruction: "Type exactly what you hear.",
      type: "DICTATION",
      dictationMode: "SENTENCE",
      difficulty: "INTERMEDIATE",
      sourceScript: "Practice makes progress.",
      passThreshold: 80,
      maxPlays: 3,
      maxAttempts: 3,
    },
  );
  dictationId = dictation.id;
  await json(request, "put", `admin/exercises/${dictationId}/draft`, admin.accessToken, {
    type: "DICTATION",
    title: "Playwright Dictation",
    instruction: "Type exactly what you hear.",
    orderIndex: 0,
    dictationMode: "SENTENCE",
    difficulty: "INTERMEDIATE",
    sourceScript: "Practice makes progress.",
    passThreshold: 80,
    maxPlays: 3,
    maxAttempts: 3,
    ignoreCapitalization: true,
    ignorePunctuation: true,
    ignoreExtraSpaces: true,
    allowMinorTypo: false,
    showTranscript: false,
    showAnswerAfterSubmit: true,
    correctText: "Practice makes progress.",
  });
  const toeic = await json<{ id: string }>(
    request,
    "post",
    "admin/exercises",
    admin.accessToken,
    {
      lessonId: lesson.id,
      title: "Playwright TOEIC",
      instruction: "Choose the best response.",
      type: "TOEIC",
      toeicPart: "PART_2",
      difficulty: "INTERMEDIATE",
      sourceScript: "When will the report be ready?",
      passThreshold: 80,
      maxPlays: 3,
      maxAttempts: 3,
    },
  );
  toeicId = toeic.id;
  const upload = await request.post(`${apiBase}/media/upload`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
    multipart: {
      file: {
        name: "playwright-audio.wav",
        mimeType: "audio/wav",
        buffer: wav(),
      },
    },
  });
  expect(upload.ok(), await upload.text()).toBeTruthy();
  const media = (await upload.json()) as { id: string };
  await json(request, "put", `admin/exercises/${toeicId}/draft`, admin.accessToken, {
    type: "TOEIC",
    title: "Playwright TOEIC",
    instruction: "Choose the best response.",
    orderIndex: 1,
    toeicPart: "PART_2",
    difficulty: "INTERMEDIATE",
    sourceScript: "When will the report be ready?",
    passThreshold: 80,
    maxPlays: 3,
    maxAttempts: 3,
    ignoreCapitalization: true,
    ignorePunctuation: true,
    ignoreExtraSpaces: true,
    allowMinorTypo: false,
    showTranscript: false,
    showAnswerAfterSubmit: true,
    groups: [
      {
        id: "playwright-toeic-group",
        title: "Question-response item 1",
        sharedScript: "When will the report be ready?",
        sharedAudioMediaId: media.id,
        questions: [
          {
            id: "playwright-toeic-question",
            text: "When will the report be ready?",
            explanation: "The answer gives a delivery time.",
            options: [
              { text: "By Friday afternoon.", correct: true },
              { text: "In the conference room.", correct: false },
              { text: "Yes, I read it.", correct: false },
            ],
          },
        ],
      },
    ],
  });
  await json(request, "patch", `admin/exercises/${dictationId}/audio`, admin.accessToken, {
    mediaId: media.id,
  });
  for (const exerciseId of [dictationId, toeicId]) {
    await json(request, "post", `admin/exercises/${exerciseId}/publish`, admin.accessToken, {});
  }
  await json(
    request,
    "post",
    `admin/courses/${course.id}/lessons/${lesson.id}/publish`,
    admin.accessToken,
    {},
  );
  await json(request, "post", `admin/courses/${course.id}/publish`, admin.accessToken, {});
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith("listenup-"))
      .forEach((key) => localStorage.removeItem(key)),
  );
});

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
}

test("login preserves a real database-backed lesson destination", async ({ page }) => {
  await page.goto(`/app/courses/${courseSlug}/lessons/${lessonSlug}`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/courses/${courseSlug}/lessons/${lessonSlug}`));
  await expect(page.getByRole("heading", { name: "Listening Practice" })).toBeVisible();
  await expect(page.getByText("Key Vocabulary")).toBeVisible();
});

test("plays backend audio, consumes one listen, and submits Dictation", async ({ page }) => {
  await login(page);
  await page.goto(`/app/exercises/${dictationId}`);
  await page.getByRole("button", { name: "Play audio", exact: true }).click();
  await expect(page.getByText(/1 \/ 3 listens used/)).toBeVisible();
  await page.getByPlaceholder("Type what you hear...").fill("Practice makes progress.");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByText("TARGET MET", { exact: true })).toBeVisible();
  await expect(page.getByText("Practice score: 100%")).toBeVisible();
});

test("submits real TOEIC option IDs and reviews the snapshot", async ({ page }) => {
  await login(page);
  await page.goto(`/app/exercises/${toeicId}`);
  await page.locator("label").filter({ hasText: /^A$/ }).click();
  await page.getByRole("button", { name: /Submit Answers/ }).click();
  await page.getByRole("button", { name: "Submit answers", exact: true }).click();
  await expect(page.getByText("Answer Review")).toBeVisible();
  await expect(page.getByText("Practice score: 100%")).toBeVisible();
});
