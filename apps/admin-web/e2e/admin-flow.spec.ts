import { expect, test, type Page } from "@playwright/test";

const studentKey = "listenup-session";
const adminKey = "listenup-admin-session-v1";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(
    ({ studentKey, adminKey }) => {
      localStorage.removeItem(adminKey);
      localStorage.setItem(studentKey, "student-session-sentinel");
    },
    { studentKey, adminKey },
  );
  await page.reload();
});

async function login(page: Page, email: string, password: string) {
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');
  await expect(emailInput).toHaveValue("");
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("ADMIN session is isolated and real course creation persists", async ({
  page,
}) => {
  await login(page, "admin@listenup-admin.test", "Admin123!");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Total Students")).toBeVisible();
  await page.getByRole("link", { name: /New Course/ }).first().click();

  const title = `Executive Listening Lab ${Date.now()}`;
  await page.getByLabel("Course title *").fill(title);
  await page
    .getByLabel("Description *")
    .fill("A persisted course created by the real admin browser flow.");
  await page.getByRole("button", { name: /Save Course/ }).click();

  await expect(page).toHaveURL(/\/courses\/[0-9a-f-]{36}\/edit/);
  await expect(
    page.getByRole("heading", { name: "Edit Course" }),
  ).toBeVisible();
  await expect(page.getByLabel("Course title *")).toHaveValue(title);
  await page.reload();
  await expect(page.getByLabel("Course title *")).toHaveValue(title);
  expect(await page.evaluate((key) => localStorage.getItem(key), studentKey)).toBe(
    "student-session-sentinel",
  );
});

test("TEACHER sees assigned scope and cannot open global settings", async ({
  page,
}) => {
  await login(page, "teacher@listenup-admin.test", "Teacher123!");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/courses");
  await expect(
    page
      .locator("strong:visible")
      .filter({ hasText: "Business English Listening" })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("TOEIC Listening Mastery")).toHaveCount(0);
  await page.goto("/site-settings");
  await expect(page).toHaveURL(/\/403/);
});

test("STUDENT is rejected from the Admin origin", async ({ page }) => {
  await login(page, "student@listenup.test", "Student123!");
  await expect(page).toHaveURL(/\/403/);
  expect(await page.evaluate((key) => localStorage.getItem(key), adminKey)).toBe(
    null,
  );
});

test("Admin logout preserves the Student session key", async ({ page }) => {
  await login(page, "admin@listenup-admin.test", "Admin123!");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByLabel("Open account menu").click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate((key) => localStorage.getItem(key), studentKey)).toBe(
    "student-session-sentinel",
  );
});
