import { copyFileSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Narrated walkthrough of the whole product, recorded as a video.
 * Captions appear at the bottom of the screen; a dot shows where the "mouse" clicks.
 */

const TWO_FA = new Set(["Dr. Ifeoma Nwosu", "Sade Johnson", "Demo Admin", "Bola Ade"]);
const READ = 3_200; // ms a caption stays up before the next action

async function installOverlay(page: Page) {
  await page.addInitScript(() => {
    const boot = () => {
      if (document.getElementById("wt-cursor")) return;
      const style = document.createElement("style");
      style.textContent = `
        #wt-cursor{position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
          background:rgba(225,29,116,.35);border:2px solid #e11d74;pointer-events:none;transition:transform .08s;left:-50px;top:-50px}
        #wt-cursor.down{transform:scale(.6);background:rgba(225,29,116,.7)}
        #wt-caption{position:fixed;z-index:2147483646;left:50%;bottom:22px;transform:translateX(-50%);max-width:1040px;width:calc(100% - 80px);
          background:rgba(15,31,32,.92);color:#fff;border-radius:14px;padding:14px 20px;font:500 17px/1.45 Inter,system-ui,sans-serif;
          box-shadow:0 10px 30px rgba(0,0,0,.3);pointer-events:none}
        #wt-caption b{display:block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#5eead4;margin-bottom:4px}`;
      document.head.appendChild(style);
      const dot = document.createElement("div");
      dot.id = "wt-cursor";
      document.body.appendChild(dot);
      window.addEventListener("mousemove", (e) => {
        dot.style.left = `${e.clientX}px`;
        dot.style.top = `${e.clientY}px`;
      });
      window.addEventListener("mousedown", () => dot.classList.add("down"));
      window.addEventListener("mouseup", () => dot.classList.remove("down"));
      const saved = sessionStorage.getItem("wt-caption");
      if (saved) {
        const { chapter, text } = JSON.parse(saved) as { chapter: string; text: string };
        (window as unknown as { __wtSay: (c: string, t: string) => void }).__wtSay?.(chapter, text);
      }
    };
    (window as unknown as { __wtSay: (c: string, t: string) => void }).__wtSay = (chapter: string, text: string) => {
      let box = document.getElementById("wt-caption");
      if (!box) {
        box = document.createElement("div");
        box.id = "wt-caption";
        document.body.appendChild(box);
      }
      box.innerHTML = `<b></b><span></span>`;
      (box.querySelector("b") as HTMLElement).textContent = chapter;
      (box.querySelector("span") as HTMLElement).textContent = text;
      sessionStorage.setItem("wt-caption", JSON.stringify({ chapter, text }));
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  });
}

async function say(page: Page, chapter: string, text: string, ms = READ) {
  await page.evaluate(
    ([c, t]) => (window as unknown as { __wtSay: (c: string, t: string) => void }).__wtSay(c as string, t as string),
    [chapter, text],
  );
  await page.waitForTimeout(ms);
}

function field(page: Page, name: string) {
  return page.getByRole("textbox", { name, exact: true });
}

async function type(page: Page, name: string, value: string) {
  await field(page, name).click();
  await field(page, name).pressSequentially(value, { delay: 25 });
}

async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: new RegExp(name.replace(".", "\\.")) }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (TWO_FA.has(name)) {
    await field(page, "Verification code").pressSequentially("123456", { delay: 40 });
    await page.getByRole("button", { name: /Verify and continue/ }).click();
  }
  await expect(page).toHaveURL(/\/(dashboard|subscription)/);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: /User menu/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function askAi(page: Page, question: string, wait = 3_800) {
  const panel = page.getByRole("dialog");
  await panel.getByRole("textbox", { name: "Ask the AI assistant" }).pressSequentially(question, { delay: 22 });
  await panel.getByRole("button", { name: "Send" }).click();
  await page.waitForTimeout(wait);
}

test("Overcare IVF — product walkthrough", async ({ page }) => {
  await installOverlay(page);
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/login");

  // ------------------------------------------------------------------ 0. intro
  await say(
    page,
    "Overcare IVF",
    "A complete IVF clinic system that many hospitals can use — each with its own link, branding and data.",
    4_500,
  );
  await say(
    page,
    "In this video",
    "1) Super admin onboards hospitals  2) Family & patient accounts with automatic billing  3) The AI assistant  4) Subscriptions & support.",
    5_000,
  );

  // ------------------------------------------------------------------ 1. super admin
  await say(
    page,
    "1 · Super admin",
    "You (the platform owner) sign in on the same login page — your account is never listed with the demo users.",
  );
  await type(page, "Email", "admin@admin.com");
  await page.getByLabel("Password").pressSequentially("Passw0rd", { delay: 40 });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/platform$/);
  await say(
    page,
    "1 · Platform overview",
    "Every hospital, its subscription status, monthly recurring revenue and the service charges you have earned on patient payments.",
    4_500,
  );
  await page
    .getByRole("cell", { name: /Lagoon Fertility Centre/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/platform\/hospitals\/lagoon/);
  await say(
    page,
    "1 · One hospital",
    "Here you control a hospital's branding, plan, your % service charge, its settlement bank account and its subscription.",
    4_500,
  );
  await page.mouse.wheel(0, 500);
  await say(
    page,
    "1 · Automatic subscriptions",
    "Status follows the paid-up date: paid → active, 1–7 days late → reminder, 8–30 → read-only, 30+ → suspended.",
    4_500,
  );
  await page.mouse.wheel(0, -500);

  await page.getByRole("link", { name: "Onboard hospital" }).first().click();
  await say(
    page,
    "1 · Onboard a hospital",
    "Name, logo, brand colour, link, plan, your fee, the hospital's bank account and its first admin user.",
  );
  await type(page, "Hospital name", "Harmony Fertility Clinic");
  await page.getByRole("button", { name: "Use colour #1D4ED8" }).click();
  await type(page, "Address", "5 Ring Road, Ibadan");
  await field(page, "City").fill("");
  await type(page, "City", "Ibadan");
  await type(page, "Phone", "08031112233");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .first()
    .pressSequentially("info@harmony.demo", { delay: 20 });
  await page.getByRole("combobox", { name: "Start with" }).click();
  await page.getByRole("option", { name: /An empty hospital/ }).click();
  await page.getByRole("spinbutton", { name: /Service charge/ }).fill("1.5");
  await type(page, "Account number (NUBAN)", "1234567890");
  await page.getByRole("button", { name: /Verify account/ }).click();
  await page.waitForTimeout(900);
  await type(page, "Full name", "Bola Ade");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .nth(1)
    .pressSequentially("bola@harmony.demo", { delay: 20 });
  await type(page, "Mobile", "08031112244");
  await say(
    page,
    "1 · Onboard a hospital",
    "Creating it sets up the hospital's own workspace, its Paystack subaccount and its first invoice.",
    2_500,
  );
  await page.getByRole("button", { name: "Create hospital" }).click();
  await expect(page.getByText("Harmony Fertility Clinic is live")).toBeVisible();
  await say(
    page,
    "1 · Hospital is live",
    "Send the admin their link. In production each hospital gets its own address, e.g. harmony.overcare.ng.",
    4_000,
  );
  await page.getByRole("link", { name: /Open Harmony Fertility/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await say(
    page,
    "1 · Their own branded login",
    "Staff of Harmony see their name and colour — and only their own hospital's data.",
    4_000,
  );

  // ------------------------------------------------------------------ 2. accounts at Overcare
  await page.goto("/h/overcare");
  await expect(page).toHaveURL(/\/login/);
  await say(
    page,
    "2 · Family & patient accounts",
    "Back at Overcare IVF. Every patient or family gets an account number. They pay into it; bills are deducted automatically.",
    4_500,
  );
  await login(page, "Peace Ogaga");
  await page.goto("/patients/new");
  await say(page, "2 · Register a couple", "The front desk registers the couple as usual…", 2_500);
  await type(page, "First name", "Ebiere");
  await type(page, "Last name", "Alagoa");
  await field(page, "Date of birth").fill("12/04/1991");
  await page.getByRole("button", { name: /Continue/ }).click();
  await type(page, "First name", "Tamuno");
  await type(page, "Last name", "Alagoa");
  await field(page, "Date of birth").fill("02/09/1987");
  await type(page, "Mobile", "08091234567");
  await page.getByRole("button", { name: /Continue/ }).click();
  await type(page, "Patient mobile", "08031239876");
  await type(page, "Address", "12 Ozumba Mbadiwe Avenue, Victoria Island");
  await type(page, "Next of kin", "Tamuno Alagoa");
  await type(page, "Next of kin mobile", "08091234567");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("combobox", { name: "Treating doctor" }).click();
  await page.getByRole("option", { name: "Dr. Ifeoma Nwosu" }).click();
  await page.getByText("Tubal factor", { exact: true }).click();
  await page.mouse.wheel(0, 600);
  await say(
    page,
    "2 · …and opens their family account",
    "One step: a family account for the couple. With the holder's BVN, Paystack issues a dedicated account number.",
  );
  await type(page, "Patient's BVN (to issue the account number)", "22212345678");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Register and open file/ }).click();
  await expect(page.getByRole("heading", { name: "Patient file" })).toBeVisible();
  await page.getByRole("tab", { name: "Billing" }).click();
  await say(
    page,
    "2 · On the patient file",
    "The couple shows as a couple, and the Billing tab shows the account that pays their bills and its account number.",
    4_500,
  );
  await logout(page);

  await login(page, "Sade Johnson");
  await page.goto("/accounts");
  await say(
    page,
    "2 · All accounts",
    "Accounts can see every family and individual account, balances, and who is low or running on credit.",
    4_000,
  );
  await page.getByRole("cell", { name: "Okafor Family" }).click();
  await say(
    page,
    "2 · A family account",
    "Account number, balances, members, statement, messages to the holder. Money in goes to the hospital's bank via Paystack.",
    4_500,
  );
  await page.getByRole("button", { name: /Simulate bank transfer/ }).click();
  await say(
    page,
    "2 · A family transfers ₦40,000",
    "Demo button standing in for the bank: the family pays ₦40,000 to their account number from any bank app.",
    3_000,
  );
  await page.getByRole("spinbutton", { name: /Amount/ }).fill("40000");
  await page.getByRole("button", { name: "Send payment" }).click();
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: "Re-send same notification" }).click();
  await say(
    page,
    "2 · Safe against duplicates",
    "Payment gateways sometimes notify twice — the same reference is never credited twice.",
    3_500,
  );
  await page.keyboard.press("Escape");
  await say(
    page,
    "2 · Credited in full",
    "The statement shows the full ₦40,000 credited — the patient never sees fees.",
    3_500,
  );
  await page.getByRole("tab", { name: /Money breakdown/ }).click();
  await say(
    page,
    "2 · Where the money went",
    "Finance staff see the split: what the patient paid, Paystack's fee, your platform service charge, and the net to the hospital.",
    5_000,
  );
  await page.getByRole("tab", { name: /Messages/ }).click();
  await say(
    page,
    "2 · Holder is notified",
    "Every deposit and deduction sends the account holder a message (WhatsApp in production).",
    3_500,
  );
  await logout(page);

  // ------------------------------------------------------------------ 3. billing → auto-debit
  await login(page, "Dr. Ifeoma Nwosu");
  await page.goto("/patients/PT-0001?tab=pharmacy");
  await say(
    page,
    "3 · Billing deducts automatically",
    "The doctor prescribes a drug for Mrs Okafor. Its cost is billed — and paid from the Okafor Family account at once.",
    4_000,
  );
  await page.getByRole("button", { name: /Add pharmacy item/ }).click();
  await page.getByRole("combobox", { name: "Drug" }).click();
  await page.getByRole("option", { name: /Folic acid/ }).click();
  await type(page, "Dosage", "5 mg");
  await type(page, "Frequency", "daily");
  await type(page, "Duration", "30 days");
  await page.getByRole("button", { name: /Prescribe/ }).click();
  await page.waitForTimeout(1_500);

  // ------------------------------------------------------------------ 4. AI
  await page.goto("/patients/PT-0001");
  await say(
    page,
    "4 · AI assistant",
    "Every screen has an AI assistant (Ctrl+J). It answers from the hospital's own records — only what your role is allowed to see.",
    4_000,
  );
  await page.getByRole("button", { name: /Ask AI/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Summarise this patient" }).click();
  await page.waitForTimeout(4_000);
  await askAi(page, "What is pending for this patient?");
  await askAi(page, "Draft a referral letter for this patient", 4_500);
  await say(
    page,
    "4 · Drafts, never decisions",
    "Letters come as editable drafts. Ask for a dose or diagnosis and it politely declines — that stays with the doctor.",
    2_500,
  );
  await askAi(page, "What dose of Gonal-F should I give her?", 4_000);
  await page.keyboard.press("Escape");
  await logout(page);

  await login(page, "Chidi Eze");
  await page.goto("/pharmacy");
  await say(
    page,
    "3 · Pharmacy sees it's paid",
    "The dispense queue shows 'Paid · account' — the pharmacist dispenses knowing the bill is settled.",
    4_500,
  );
  const row = page.getByRole("row", { name: /Adaobi Okafor.*Folic acid/ });
  await row.getByRole("button", { name: /Dispense/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Dispense" }).click();
  await page.waitForTimeout(1_500);
  await logout(page);

  await login(page, "Sade Johnson");
  await page.goto("/accounts/WAL-0001");
  await say(
    page,
    "3 · On the statement",
    "The deduction is on the family's statement with what it paid for, who it was for, and the new balance — and in the audit trail.",
    4_500,
  );
  await page.getByRole("button", { name: /Ask AI/ }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Ask the AI assistant" }).fill("");
  await askAi(page, "Which family accounts are low on balance?", 4_000);
  await askAi(page, "How much did we collect this month, and what were the fees?", 5_000);
  await page.keyboard.press("Escape");
  await page.goto("/billing?tab=settlements");
  await say(
    page,
    "3 · Collections & settlements",
    "Every payment for the period: patient paid, gateway fee, platform fee and net settled to the hospital's bank.",
    4_500,
  );
  await logout(page);

  // ------------------------------------------------------------------ 5. admin: credit, branding, subscription, support
  await login(page, "Demo Admin");
  await page.goto("/accounts?filter=low");
  await page.getByRole("cell", { name: "Musa Family" }).click();
  await say(
    page,
    "5 · Credit for trusted families",
    "When a family runs low, only a hospital admin can allow a credit limit — with a reason, recorded in the audit trail.",
    3_500,
  );
  await page.getByRole("button", { name: /Credit limit/ }).click();
  await page.getByRole("spinbutton", { name: /Credit limit/ }).fill("100000");
  await type(page, "Reason", "Long-standing patient; agreed with the MD");
  await page.getByRole("button", { name: "Approve limit" }).click();
  await page.waitForTimeout(1_800);
  await page.goto("/admin?tab=branding");
  await say(
    page,
    "5 · Hospital branding",
    "Each hospital admin manages their own logo, colour and details, and sees their link and settlement account.",
    4_500,
  );
  await page.goto("/subscription");
  await say(
    page,
    "5 · Subscription & support",
    "Plan, paid-up date, invoices — and support tickets straight to you.",
    3_500,
  );
  await page.getByRole("button", { name: /Raise ticket/ }).click();
  await type(page, "Subject", "Training for two new nurses");
  await page
    .getByRole("textbox", { name: "Describe the issue" })
    .pressSequentially("Two new nurses start Monday. Can we book a short training session?", { delay: 15 });
  await page.getByRole("button", { name: "Send to support" }).click();
  await page.waitForTimeout(1_500);
  await logout(page);

  // ------------------------------------------------------------------ 6. lapsed hospital pays
  await page.goto("/h/lagoon");
  await expect(page).toHaveURL(/\/login/);
  await say(
    page,
    "6 · A hospital that's late",
    "Lagoon Fertility is 3 days late. Its staff see a reminder — and the admin can pay in two clicks.",
    3_500,
  );
  await login(page, "Demo Admin");
  await page.waitForTimeout(2_500);
  await page.goto("/subscription");
  await page.getByRole("button", { name: /Pay subscription/ }).click();
  await page.getByText("12 months — 2 months free").click();
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: /Continue to pay/ }).click();
  await say(
    page,
    "6 · Paystack checkout",
    "In production this is Paystack's checkout. Paying extends the subscription automatically — no one has to switch anything on.",
    3_500,
  );
  await page.getByRole("button", { name: /^Pay ₦/ }).click();
  await page.waitForTimeout(2_500);
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(1_500);
  await logout(page);

  // ------------------------------------------------------------------ 7. support desk
  await page.goto("/login");
  await type(page, "Email", "admin@admin.com");
  await page.getByLabel("Password").pressSequentially("Passw0rd", { delay: 30 });
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/platform/tickets");
  await say(
    page,
    "7 · Your support desk",
    "Tickets from every hospital in one place. Reply, set the status, close.",
    3_000,
  );
  await page.getByRole("cell", { name: "Training for two new nurses" }).click();
  await page
    .getByRole("textbox", { name: "Reply" })
    .pressSequentially("Booked for Thursday 10am — see you then!", { delay: 20 });
  await page.getByRole("button", { name: "Send reply" }).click();
  await page.waitForTimeout(2_000);
  await page.keyboard.press("Escape");
  await page.goto("/platform");
  await say(
    page,
    "That's Overcare IVF",
    "Multi-hospital, branded, automatic patient billing with family accounts, an AI assistant, and subscriptions that run themselves.",
    6_000,
  );

  // save the recording next to the project
  const video = page.video();
  await page.close();
  if (video) {
    mkdirSync("demo-video", { recursive: true });
    copyFileSync(await video.path(), "demo-video/overcare-walkthrough.webm");
  }
});
