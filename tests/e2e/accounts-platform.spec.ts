import { expect, test, type Page } from "@playwright/test";

const TWO_FA = new Set(["Dr. Ifeoma Nwosu", "Sade Johnson", "Demo Admin", "Bola Ade"]);

function field(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

async function login(page: Page, name: string, landing = /\/dashboard/) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name.replace(".", "\\.")) }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (TWO_FA.has(name)) {
    await field(page, "Verification code").fill("123456");
    await page.getByRole("button", { name: /Verify and continue/ }).click();
  }
  await expect(page).toHaveURL(landing);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: /User menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function superAdminLogin(page: Page) {
  await page.goto("/login");
  await field(page, "Email").fill("admin@admin.com");
  await page.getByLabel("Password").fill("Passw0rd");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/platform$/);
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe.configure({ mode: "serial" });

test("family account: transfer, duplicate webhook, auto-debit on billing", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());

  await login(page, "Sade Johnson");
  await page.goto("/accounts");
  await page.getByRole("cell", { name: "Okafor Family" }).click();
  await expect(page).toHaveURL(/\/accounts\/WAL-0001/);
  await expect(page.getByTestId("account-number")).toHaveText(/^\d{10}$/);

  await page.getByRole("button", { name: /Simulate bank transfer/ }).click();
  await page.getByRole("spinbutton", { name: /Amount/ }).fill("40000");
  await page.getByRole("button", { name: "Send payment" }).click();
  await expect(page.getByText(/₦40,000 received — balance/)).toBeVisible();
  await page.getByRole("button", { name: "Re-send same notification" }).click();
  await expect(page.getByText(/Duplicate notification .* ignored/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("cell", { name: /Bank transfer from/ }).first()).toBeVisible();
  await logout(page);

  // doctor orders a test → the charge is paid from the family account straight away
  await login(page, "Dr. Ifeoma Nwosu");
  await page.goto("/patients/PT-0001?tab=investigations");
  await page.getByRole("button", { name: /Order investigation/ }).click();
  await page.getByRole("combobox", { name: "Test" }).click();
  await page
    .getByRole("option", { name: /Prolactin/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("cell", { name: "Prolactin" }).first()).toBeVisible();
  await logout(page);

  await login(page, "Sade Johnson");
  await page.goto("/accounts/WAL-0001");
  await expect(page.getByRole("cell", { name: /Paid: Prolactin/ }).first()).toBeVisible();
  await page.getByRole("tab", { name: /Money breakdown/ }).click();
  await expect(page.getByText("Platform service charge").first()).toBeVisible();
  await page.goto("/patients/PT-0001?tab=billing");
  await expect(page.getByText(/Paid from Okafor Family/)).toBeVisible();
  await logout(page);

  expect(errors).toEqual([]);
});

test("AI assistant answers within the role and declines clinical decisions", async ({ page }) => {
  const errors = watchErrors(page);
  await login(page, "Dr. Ifeoma Nwosu");
  await page.goto("/patients/PT-0001");
  await page.getByRole("button", { name: /Ask AI/ }).click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Summarise this patient" }).click();
  await expect(panel.getByText(/Adaobi Okafor, \d+ years/)).toBeVisible();
  await panel.getByRole("textbox", { name: "Ask the AI assistant" }).fill("What dose of Gonal-F should I give her?");
  await panel.getByRole("button", { name: "Send" }).click();
  await expect(panel.getByText("Declined")).toBeVisible();
  await page.keyboard.press("Escape");
  await logout(page);

  await login(page, "Grace Otuyo");
  await page.getByRole("button", { name: /Ask AI/ }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Ask the AI assistant" }).fill("Who owes us money?");
  await page.getByRole("dialog").getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("dialog").getByText(/doesn't have access to billing/)).toBeVisible();
  await page.keyboard.press("Escape");
  await logout(page);
  expect(errors).toEqual([]);
});

test("super admin onboards a hospital that gets its own branded, empty workspace", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /admin@admin\.com/ })).toHaveCount(0);
  await superAdminLogin(page);
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();

  await page.getByRole("link", { name: "Onboard hospital" }).first().click();
  await field(page, "Hospital name").fill("Harmony Fertility Clinic");
  await field(page, "Address").fill("5 Ring Road, Ibadan");
  await field(page, "City").fill("Ibadan");
  await field(page, "Phone").fill("08031112233");
  await page.getByRole("textbox", { name: "Email", exact: true }).first().fill("info@harmony.demo");
  await page.getByRole("combobox", { name: "Start with" }).click();
  await page.getByRole("option", { name: /An empty hospital/ }).click();
  await field(page, "Account number (NUBAN)").fill("1234567890");
  await page.getByRole("button", { name: /Verify account/ }).click();
  await expect(field(page, "Account name")).toHaveValue("HARMONY FERTILITY CLINIC");
  await field(page, "Full name").fill("Bola Ade");
  await page.getByRole("textbox", { name: "Email", exact: true }).nth(1).fill("bola@harmony.demo");
  await field(page, "Mobile").fill("08031112244");
  await page.getByRole("button", { name: "Create hospital" }).click();
  await expect(page.getByText("Harmony Fertility Clinic is live")).toBeVisible();

  await page.getByRole("link", { name: /Open Harmony Fertility/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Harmony Fertility Clinic").first()).toBeVisible();
  await login(page, "Bola Ade");
  for (const path of ["/patients", "/accounts", "/billing", "/pharmacy", "/reports", "/embryology", "/waiting-list"]) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
  }
  await logout(page);
  expect(errors).toEqual([]);
});

test("hospital pays its subscription and raises a ticket; super admin replies", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/h/lagoon");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Lagoon Fertility Centre").first()).toBeVisible();
  await login(page, "Demo Admin");
  await expect(page.getByText(/Payment overdue \(grace\)/).first()).toBeVisible();
  await page.goto("/subscription");
  await page.getByRole("button", { name: /Pay subscription/ }).click();
  await page.getByRole("button", { name: /Continue to pay/ }).click();
  await page.getByRole("button", { name: /^Pay ₦/ }).click();
  await expect(page.getByText("Payment successful")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /Raise ticket/ }).click();
  await field(page, "Subject").fill("E2E: need training for new nurses");
  await page
    .getByRole("textbox", { name: "Describe the issue" })
    .fill("Two new nurses started on Monday and need a walkthrough.");
  await page.getByRole("button", { name: "Send to support" }).click();
  await expect(page.getByText(/Ticket TKT-\d+ sent to support/)).toBeVisible();
  await logout(page);

  await superAdminLogin(page);
  await page.goto("/platform/tickets");
  await page.getByRole("cell", { name: "E2E: need training for new nurses" }).click();
  await page.getByRole("textbox", { name: "Reply" }).fill("Booked for Thursday 10am — see you then.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Reply sent")).toBeVisible();
  expect(errors).toEqual([]);
});
