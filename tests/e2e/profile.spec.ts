import { expect, test } from "@playwright/test";

test("a user views their read-only profile and changes their password", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");

  await page.getByRole("button", { name: /Grace Otuyo/ }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("button", { name: /User menu/ }).click();
  await page.getByRole("menuitem", { name: /My profile/ }).click();
  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await expect(page.getByText("grace.otuyo@rhv.demo")).toBeVisible();
  // Details are read-only: the only text inputs on the page are the two new-password fields
  await expect(page.getByRole("textbox")).toHaveCount(2);
  await expect(page.locator('input[type="password"]')).toHaveCount(2);
  await expect(page.getByText(/Ask an administrator or HR to change these details/)).toBeVisible();

  const pw = (label: string) => page.getByLabel(new RegExp(`^${label}`));
  await pw("New password").fill("Nurse#2026");
  await pw("Confirm new password").fill("Nurse#2027");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("The passwords do not match")).toBeVisible();

  await pw("Confirm new password").fill("Nurse#2026");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();

  await page.getByRole("button", { name: /User menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("button", { name: /Grace Otuyo/ }).click();
  await expect(page.getByText(/has set a personal password/)).toBeVisible();
  await page.getByLabel(/^Password/).fill("Demo@1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/Email or password is incorrect/)).toBeVisible();
  await page.getByLabel(/^Password/).fill("Nurse#2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  expect(consoleErrors).toEqual([]);
});
