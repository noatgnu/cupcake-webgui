import { test, expect } from "../fixtures/auth";
import { ProtocolEditorPage } from "../page-objects/cupcake/protocol-editor.po";

const PROTOCOL_TITLE = `E2E Protocol ${Date.now()}`;

test.describe("protocols", () => {
  test.afterEach(async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    try { await editor.deleteProtocol(PROTOCOL_TITLE); } catch { /* may not exist */ }
  });

  test("protocol list page loads", async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    await expect(adminPage).toHaveURL(/\/protocols/, { timeout: 10000 });
  });

  test("create protocol appears in list", async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await expect(adminPage.getByText(PROTOCOL_TITLE)).toBeVisible({ timeout: 10000 });
  });

  test("open protocol shows editor", async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.openEditor(PROTOCOL_TITLE);
    await expect(adminPage).toHaveURL(/\/protocols\/\d+|\/protocols\/editor/, { timeout: 10000 });
  });

  test("add section to protocol", async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.openEditor(PROTOCOL_TITLE);
    await editor.addSection("Sample Preparation");
    await expect(adminPage.getByText("Sample Preparation")).toBeVisible({ timeout: 10000 });
  });

  test("add section and step to protocol", async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.openEditor(PROTOCOL_TITLE);
    await editor.addSection("Section 1");
    await editor.addStep("Section 1", "Prepare samples at RT", 10);
    await expect(adminPage.getByText("Prepare samples at RT")).toBeVisible({ timeout: 10000 });
  });
});
