/**
 * Page object for session detail (/protocols/sessions/:id).
 */
import { Page, expect, Download } from "@playwright/test";

export class SessionDetailPage {
  constructor(private readonly page: Page) {}

  async gotoList(): Promise<void> {
    await this.page.goto("/#/protocols/sessions");
  }

  async createFromProtocol(protocolTitle: string): Promise<void> {
    await this.page.goto("/#/protocols");
    await this.page.locator(".protocol-list-item").filter({ hasText: protocolTitle }).click();
    await this.page.getByRole("button", { name: /start session/i }).click();
    const sessionName = `E2E Session ${Date.now()}`;
    await this.page.locator("#sessionName").fill(sessionName);
    await this.page.locator(".modal-footer .btn-primary").click();
    await expect(this.page).toHaveURL(/\/protocols\/sessions/, { timeout: 15000 });
    await this.page.locator(".list-group-item-action").filter({ hasText: sessionName }).first().click();
    await this.page.locator("button.btn-outline-success[title='Open Session']").click();
    await expect(this.page).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 10000 });
  }

  async addTextAnnotation(content: string): Promise<void> {
    await this.page.getByRole("button", { name: "Add Annotation" }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Add Annotation");
    await this.page.locator("#textAnnotation").fill(content);

    const postWait = this.page.waitForResponse(resp => resp.url().includes("/step-annotations/") && resp.request().method() === "POST", { timeout: 30000 });
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/step-annotations/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Save" }).click();
    await postWait;
    await refreshWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async getCurrentAnnotationText(): Promise<string> {
    return this.page.locator(".annotation-text p").first().innerText();
  }

  async uploadAudioAnnotation(filePath: string): Promise<void> {
    await this.page.getByRole("button", { name: "Add Annotation" }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Add Annotation");
    await this.page.locator('label[for="modeUpload"]').click();
    await this.page.locator("#annotationFile").setInputFiles(filePath);

    const postWait = this.page.waitForResponse(resp => resp.url().includes("/upload/step-annotation-chunks/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Save" }).click();
    await postWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async waitForTranscriptionCompleted(timeoutMs = 120000): Promise<void> {
    // queue_annotation_transcription() always requests translate=True, so the
    // toast reads "Transcription and translation completed", not the plain form.
    await expect(this.page.locator(".toast-container").getByText(/Transcription.*completed/i)).toBeVisible({ timeout: timeoutMs });
  }

  async getTranscriptionCueText(): Promise<string> {
    return this.page.locator(".transcription .cue-text").first().innerText();
  }

  async startStepTimer(): Promise<void> {
    await this.page.getByTitle("Start Timer").click();
    await expect(this.page.getByTitle("Pause Timer")).toBeVisible({ timeout: 8000 });
  }

  async pauseStepTimer(): Promise<void> {
    await this.page.getByTitle("Pause Timer").click();
    await expect(this.page.getByTitle("Start Timer")).toBeVisible({ timeout: 8000 });
  }

  async resetStepTimer(): Promise<void> {
    await this.page.getByTitle("Reset Timer").click();
    await expect(this.page.getByTitle("Start Timer")).toBeVisible({ timeout: 5000 });
  }

  async getStepTimerDisplay(): Promise<string> {
    const text = await this.page.locator("span.font-monospace").first().innerText();
    return text.trim();
  }

  stepReagentRow(stepReagentName: string) {
    return this.page.locator(".step-reagents .list-group-item").filter({ hasText: stepReagentName });
  }

  async bookReagent(stepReagentName: string, storageLocationName: string, quantity: number, notes?: string): Promise<void> {
    await this.stepReagentRow(stepReagentName).getByTitle("Book this reagent").click();
    await expect(this.page.locator(".modal-title")).toContainText("Book Reagent");

    const row = this.page.locator(".list-group-item-action").filter({ hasText: storageLocationName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    await this.page.locator("#quantity").fill(String(quantity));
    if (notes) {
      await this.page.locator("#notes").fill(notes);
    }

    const postWait = this.page.waitForResponse(resp => resp.url().includes("/reagent-actions/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Book Reagent" }).click();
    await postWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async getStepReagentBookedText(stepReagentName: string): Promise<string> {
    return this.stepReagentRow(stepReagentName).innerText();
  }

  async exportSessionHtml(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download", { timeout: 30000 }),
      this.page.getByTitle("Export session with all protocols and annotations as HTML").click(),
    ]);
    return download;
  }
}
