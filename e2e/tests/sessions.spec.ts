import { test, expect } from "../fixtures/auth";
import { ProtocolEditorPage } from "../page-objects/cupcake/protocol-editor.po";
import { SessionDetailPage } from "../page-objects/cupcake/session-detail.po";

const PROTOCOL_TITLE = `E2E Session Protocol ${Date.now()}`;

test.describe("sessions", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    const ctx = await browser.newContext({ storageState: require("path").join(__dirname, "../auth-states/admin.json") });
    const page = await ctx.newPage();
    const editor = new ProtocolEditorPage(page);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.openEditor(PROTOCOL_TITLE);
    await editor.addSection("Section 1");
    await editor.addStep("Section 1", "Step 1", 10);
    await page.context().close();
  });

  test("session list page loads", async ({ adminPage }) => {
    const session = new SessionDetailPage(adminPage);
    await session.gotoList();
    await expect(adminPage).toHaveURL(/\/protocols\/sessions/, { timeout: 10000 });
  });

  test("create session from protocol", async ({ adminPage }) => {
    const session = new SessionDetailPage(adminPage);
    await session.gotoList();
    await session.createFromProtocol(PROTOCOL_TITLE);
    await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
  });

  test("session detail shows steps", async ({ adminPage }) => {
    const session = new SessionDetailPage(adminPage);
    await session.gotoList();
    await session.createFromProtocol(PROTOCOL_TITLE);
    await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
    await expect(adminPage.getByText("Step 1")).toBeVisible({ timeout: 10000 });
  });
});
