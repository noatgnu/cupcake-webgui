import { test, expect } from "../fixtures/auth";
import { ProtocolEditorPage } from "../page-objects/cupcake/protocol-editor.po";
import { SessionDetailPage } from "../page-objects/cupcake/session-detail.po";

const PROTOCOL_TITLE = `E2E Timer Protocol ${Date.now()}`;

test.describe("timekeepers", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    const ctx = await browser.newContext({ storageState: require("path").join(__dirname, "../auth-states/admin.json") });
    const page = await ctx.newPage();

    const editor = new ProtocolEditorPage(page);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.addSection("Section 1");
    await editor.addStep("Section 1", "Incubate 10 min", 10);

    const session = new SessionDetailPage(page);
    await session.gotoList();
    await session.createFromProtocol(PROTOCOL_TITLE);
    await page.context().close();
  });

  test("timers panel loads", async ({ adminPage }) => {
    await adminPage.goto("/#/protocols/timers");
    await expect(adminPage).toHaveURL(/\/protocols\/timers/, { timeout: 10000 });
  });

  test("timer from created session is listed", async ({ adminPage }) => {
    await adminPage.goto("/#/protocols/timers");
    await expect(
      adminPage.getByText(new RegExp(PROTOCOL_TITLE.slice(0, 20), "i"))
    ).toBeVisible({ timeout: 15000 });
  });

  test("start timer shows active state", async ({ adminPage }) => {
    await adminPage.goto("/#/protocols/timers");
    const timerRow = adminPage.locator("[class*='timer'], tr").filter({
      hasText: new RegExp(PROTOCOL_TITLE.slice(0, 15), "i"),
    }).first();
    await expect(timerRow).toBeVisible({ timeout: 15000 });

    const startBtn = timerRow.getByRole("button", { name: /start|run|play/i });
    if (await startBtn.isVisible({ timeout: 2000 })) {
      await startBtn.click();
      await expect(timerRow.getByText(/pause|stop|running|active/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
