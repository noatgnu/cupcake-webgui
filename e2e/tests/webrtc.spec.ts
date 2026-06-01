import { test, expect } from "../fixtures/auth";
import { ProtocolEditorPage } from "../page-objects/cupcake/protocol-editor.po";
import { SessionDetailPage } from "../page-objects/cupcake/session-detail.po";

const PROTOCOL_TITLE = `E2E WebRTC Protocol ${Date.now()}`;
let sessionUrl = "";

test.describe("WebRTC live session panel", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: require("path").join(__dirname, "../auth-states/admin.json") });
    const page = await ctx.newPage();

    const editor = new ProtocolEditorPage(page);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.openEditor(PROTOCOL_TITLE);
    await editor.addSection("Section 1");
    await editor.addStep("Section 1", "Step 1", 5);

    const session = new SessionDetailPage(page);
    await session.gotoList();
    await session.createFromProtocol(PROTOCOL_TITLE);
    sessionUrl = page.url();
    await page.context().close();
  });

  test("Live Session button is visible on session detail page", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 10000 });
    await expect(adminPage.getByRole("button", { name: /live session/i })).toBeVisible({ timeout: 10000 });
  });

  test("clicking Live Session toggles WebRTC panel visibility", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await adminPage.getByRole("button", { name: /live session/i }).click();
    await expect(adminPage.locator("app-session-webrtc-panel")).toBeVisible({ timeout: 5000 });
    await expect(adminPage.locator(".webrtc-panel")).toBeVisible({ timeout: 5000 });
  });

  test("WebRTC panel shows Disconnected state initially", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await adminPage.getByRole("button", { name: /live session/i }).click();
    await expect(adminPage.locator(".webrtc-panel")).toBeVisible({ timeout: 5000 });
    await expect(
      adminPage.locator(".badge.bg-secondary").filter({ hasText: "Disconnected" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("Connect button is visible when disconnected", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await adminPage.getByRole("button", { name: /live session/i }).click();
    await expect(adminPage.locator(".webrtc-panel")).toBeVisible({ timeout: 5000 });
    const connectBtn = adminPage
      .locator(".webrtc-panel .btn-success")
      .filter({ has: adminPage.locator(".bi-play-circle") });
    await expect(connectBtn).toBeVisible({ timeout: 5000 });
    await expect(connectBtn).not.toBeDisabled({ timeout: 2000 });
  });

  test("clicking Connect shows Connected badge", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await adminPage.getByRole("button", { name: /live session/i }).click();
    await expect(adminPage.locator(".webrtc-panel")).toBeVisible({ timeout: 5000 });
    const connectBtn = adminPage
      .locator(".webrtc-panel .btn-success")
      .filter({ has: adminPage.locator(".bi-play-circle") });
    await connectBtn.click();
    await expect(
      adminPage.locator(".badge.bg-success").filter({ hasText: "Connected" })
    ).toBeVisible({ timeout: 15000 });
  });

  test("disconnect returns panel to Disconnected state", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await adminPage.getByRole("button", { name: /live session/i }).click();
    await expect(adminPage.locator(".webrtc-panel")).toBeVisible({ timeout: 5000 });
    const connectBtn = adminPage
      .locator(".webrtc-panel .btn-success")
      .filter({ has: adminPage.locator(".bi-play-circle") });
    await connectBtn.click();
    await expect(
      adminPage.locator(".badge.bg-success").filter({ hasText: "Connected" })
    ).toBeVisible({ timeout: 15000 });
    const disconnectBtn = adminPage
      .locator(".webrtc-panel .btn-danger")
      .filter({ has: adminPage.locator(".bi-stop-circle") });
    await disconnectBtn.click();
    await expect(
      adminPage.locator(".badge.bg-secondary").filter({ hasText: "Disconnected" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("chat panel opens when chat button clicked", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await adminPage.getByRole("button", { name: /live session/i }).click();
    await expect(adminPage.locator(".webrtc-panel")).toBeVisible({ timeout: 5000 });
    await adminPage.locator(".webrtc-panel").getByTitle("Chat").click();
    await expect(adminPage.locator(".panel-chat")).toBeVisible({ timeout: 5000 });
  });

  test("send chat message appears in chat history after connecting", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await adminPage.getByRole("button", { name: /live session/i }).click();
    await expect(adminPage.locator(".webrtc-panel")).toBeVisible({ timeout: 5000 });

    const connectBtn = adminPage
      .locator(".webrtc-panel .btn-success")
      .filter({ has: adminPage.locator(".bi-play-circle") });
    await connectBtn.click();
    await expect(
      adminPage.locator(".badge.bg-success").filter({ hasText: "Connected" })
    ).toBeVisible({ timeout: 15000 });

    await adminPage.locator(".webrtc-panel").getByTitle("Chat").click();
    await expect(adminPage.locator(".panel-chat")).toBeVisible({ timeout: 5000 });

    const chatInput = adminPage.locator(".chat-input-container input[type='text']");
    await chatInput.fill("E2E test message");
    await adminPage.locator(".chat-input-container .btn-primary").click();
    await expect(
      adminPage.locator(".chat-message-text").filter({ hasText: "E2E test message" })
    ).toBeVisible({ timeout: 10000 });
  });
});
