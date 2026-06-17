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
    await editor.gotoList();
    await expect(adminPage.locator(".protocol-list-item").filter({ hasText: PROTOCOL_TITLE })).toBeVisible({ timeout: 10000 });
  });

  test("open protocol shows editor", async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await expect(adminPage).toHaveURL(/\/protocols\/\d+\/edit/, { timeout: 10000 });
  });

  test("add section to protocol", async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.addSection("Sample Preparation");
  });

  test("add section and step to protocol", async ({ adminPage }) => {
    const editor = new ProtocolEditorPage(adminPage);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
    await editor.addSection("Section 1");
    await editor.addStep("Section 1", "Prepare samples at RT", 10);
    await expect(adminPage.getByText("Prepare samples at RT")).toBeVisible({ timeout: 10000 });
  });

  test.describe("step reagents and reagent templates", () => {
    const REAGENT_PROTOCOL_TITLE = `E2E Reagent Protocol ${Date.now()}`;
    const STEP_DESCRIPTION = `Add reagent to sample ${Date.now()}`;
    const REAGENT_NAME = `E2E Step Reagent ${Date.now()}`;

    test.afterEach(async ({ adminPage }) => {
      const editor = new ProtocolEditorPage(adminPage);
      await editor.gotoList();
      try { await editor.deleteProtocol(REAGENT_PROTOCOL_TITLE); } catch { /* may not exist */ }
    });

    test("add reagent to a step and shows it in the reagent list", async ({ adminPage }) => {
      const editor = new ProtocolEditorPage(adminPage);
      await editor.gotoList();
      await editor.createProtocol(REAGENT_PROTOCOL_TITLE);
      await editor.addSection("Section 1");
      await editor.addStep("Section 1", STEP_DESCRIPTION, 5);

      await editor.addStepReagent(STEP_DESCRIPTION, REAGENT_NAME, "uL", 25);

      await expect(editor.stepListItem(STEP_DESCRIPTION).getByText(REAGENT_NAME)).toBeVisible({ timeout: 10000 });
      await expect(editor.stepListItem(STEP_DESCRIPTION)).toContainText("Quantity: 25");
    });

    test("insert reagent quantity template into step description renders substituted value", async ({ adminPage }) => {
      const editor = new ProtocolEditorPage(adminPage);
      await editor.gotoList();
      await editor.createProtocol(REAGENT_PROTOCOL_TITLE);
      await editor.addSection("Section 1");
      await editor.addStep("Section 1", STEP_DESCRIPTION, 5);

      await editor.addStepReagent(STEP_DESCRIPTION, REAGENT_NAME, "uL", 25);
      await editor.insertReagentTemplateIntoStep(STEP_DESCRIPTION, "quantity");

      await expect(editor.stepListItem(STEP_DESCRIPTION).locator(".template-value")).toBeVisible({ timeout: 10000 });
      const value = await editor.getStepTemplateValue(STEP_DESCRIPTION);
      expect(value).toBe("25");
    });

    test("insert reagent unit and name templates render substituted values", async ({ adminPage }) => {
      const editor = new ProtocolEditorPage(adminPage);
      await editor.gotoList();
      await editor.createProtocol(REAGENT_PROTOCOL_TITLE);
      await editor.addSection("Section 1");
      await editor.addStep("Section 1", STEP_DESCRIPTION, 5);

      await editor.addStepReagent(STEP_DESCRIPTION, REAGENT_NAME, "mL", 5);
      await editor.insertReagentTemplateIntoStep(STEP_DESCRIPTION, "unit");

      const unitValue = await editor.getStepTemplateValue(STEP_DESCRIPTION);
      expect(unitValue).toBe("mL");
    });
  });
});
