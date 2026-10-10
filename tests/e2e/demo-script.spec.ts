import { expect, test, type Page } from "@playwright/test";

const TWO_FA = new Set(["Dr. Ifeoma Nwosu", "Sade Johnson", "Demo Admin"]);

function field(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name.replace(".", "\\.")) }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (TWO_FA.has(name)) {
    await field(page, "Verification code").fill("123456");
    await page.getByRole("button", { name: /Verify and continue/ }).click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: /User menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function pick(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).first().click();
}

test.describe.configure({ mode: "serial" });

test("demo script: front desk → doctor → pharmacy → accountant → approvals → admin", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(e.message));

  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());

  // 1. Front desk: dashboard, waiting list, register a new couple
  await login(page, "Peace Ogaga");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("link", { name: /Front-desk postings today/ }).click();
  await expect(page.getByRole("heading", { name: "Waiting list" })).toBeVisible();
  await expect(page.getByText("Tonye Cookey")).toBeVisible();

  await page.goto("/patients/new");
  await field(page, "First name").fill("Ebiere");
  await field(page, "Last name").fill("Alagoa");
  await field(page, "Date of birth").fill("12/04/1991");
  await page.getByRole("button", { name: /Continue/ }).click();
  await field(page, "First name").fill("Tamuno");
  await field(page, "Last name").fill("Alagoa");
  await field(page, "Date of birth").fill("02/09/1987");
  await field(page, "Mobile").fill("08091234567");
  await page.getByRole("button", { name: /Continue/ }).click();
  await field(page, "Patient mobile").fill("08031239876");
  await field(page, "Address").fill("12 Ozumba Mbadiwe Avenue, Victoria Island");
  await field(page, "Next of kin").fill("Tamuno Alagoa");
  await field(page, "Next of kin mobile").fill("08091234567");
  await page.getByRole("button", { name: /Continue/ }).click();
  await pick(page, "Treating doctor", "Dr. Ifeoma Nwosu");
  await page.getByText("Tubal factor", { exact: true }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Register and open file/ }).click();
  await expect(page.getByRole("heading", { name: "Patient file" })).toBeVisible();
  await expect(page.getByText(/Mrs Ebiere\s+Alagoa/)).toBeVisible();
  await logout(page);

  // 2. Nurse cannot open billing → 403 + audit
  await login(page, "Grace Otuyo");
  await page.goto("/billing");
  await expect(page.getByText("403 · ACCESS RESTRICTED")).toBeVisible();
  await logout(page);

  // 3. Doctor: note on couple 1, order a lab test (creates a charge)
  await login(page, "Dr. Ifeoma Nwosu");
  await page.goto("/patients/PT-0001?tab=notes");
  await field(page, "New doctor note").fill("E2E: reviewed D8 scan, continue current dose.");
  await page.getByRole("button", { name: "Post note" }).click();
  await expect(page.getByText("E2E: reviewed D8 scan, continue current dose.")).toBeVisible();
  await page.goto("/patients/PT-0001?tab=investigations");
  await page.getByRole("button", { name: /Order investigation/ }).click();
  await pick(page, "Test", /Prolactin/);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("cell", { name: "Prolactin" }).first()).toBeVisible();
  await page.goto("/patients/PT-0001/cycles/CY-0002");
  await expect(page.getByText("Follicle growth", { exact: true })).toBeVisible();
  await logout(page);

  // 4. Pharmacist dispenses from the queue
  await login(page, "Chidi Eze");
  await page.goto("/pharmacy");
  const row = page.getByRole("row", { name: /Adaobi Okafor.*Cetrorelix/ });
  await row.getByRole("button", { name: /Dispense/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Dispense" }).click();
  await expect(page.getByText(/Dispensed Cetrorelix/)).toBeVisible();
  await logout(page);

  // 5. Accountant records a part-payment; the charge is in billing
  await login(page, "Sade Johnson");
  await page.goto("/patients/PT-0001?tab=billing");
  await expect(page.getByRole("cell", { name: /Prolactin/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Record payment/ }).click();
  await page.getByRole("spinbutton", { name: /Amount/ }).fill("5000");
  await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Payment recorded — receipt RCP-/)).toBeVisible();
  await logout(page);

  // 6. Nurse leave request → manager approves → nurse notified
  await login(page, "Grace Otuyo");
  await page.goto("/requests");
  await page.getByRole("button", { name: /New request/ }).click();
  await pick(page, "Request type", "Leave");
  await field(page, "Title").fill("E2E annual leave");
  await field(page, "Details").fill("Family wedding in Benin");
  await field(page, "From").fill("11/01/2027");
  await field(page, "To").fill("13/01/2027");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Request submitted for approval")).toBeVisible();
  await logout(page);

  await login(page, "Osaze Idemudia");
  await page.goto("/requests?tab=approvals");
  await page
    .getByRole("row", { name: /E2E annual leave/ })
    .getByRole("button", { name: /Approve/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/Request approved — requester notified/)).toBeVisible();
  await logout(page);

  await login(page, "Grace Otuyo");
  await page.getByRole("button", { name: /Notifications/ }).click();
  await expect(page.getByText(/E2E annual leave was approved/)).toBeVisible();
  await page.keyboard.press("Escape");
  await logout(page);

  // 7. Admin: audit trail and reset
  await login(page, "Demo Admin");
  await page.goto("/admin?tab=audit");
  await page.getByRole("textbox", { name: "Search summaries…" }).fill("Access denied to /billing");
  await expect(page.getByText(/Access denied to \/billing/).first()).toBeVisible();
  await page.goto("/admin?tab=data");
  await page
    .getByRole("button", { name: /Reset demo data/ })
    .first()
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Reset data" }).click();
  await expect(page.getByText("Demo data restored to the original seed.")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
