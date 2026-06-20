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
    await this.page.getByRole("button", { name: /^Add( Annotation)?$/ }).click();
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

  async uploadFileAnnotation(filePath: string, annotationText?: string): Promise<void> {
    await this.page.getByRole("button", { name: /^Add( Annotation)?$/ }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Add Annotation");
    await this.page.locator('label[for="modeUpload"]').click();
    await this.page.locator("#annotationFile").setInputFiles(filePath);
    if (annotationText) {
      await this.page.locator("#annotationText").fill(annotationText);
    }

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

  annotationItem() {
    return this.page.locator(".annotation-item");
  }

  async getCurrentAnnotationTypeLabel(): Promise<string> {
    return this.annotationItem().locator(".fw-semibold").first().innerText();
  }

  async expectVideoAnnotationVisible(): Promise<void> {
    await expect(this.annotationItem().locator("video")).toBeVisible({ timeout: 10000 });
  }

  async expectImageAnnotationVisible(): Promise<void> {
    await expect(this.annotationItem().locator("img")).toBeVisible({ timeout: 10000 });
  }

  async toggleScratchCurrentAnnotation(): Promise<void> {
    await this.annotationItem().getByTitle("Scratch off").click();
    await expect(this.page.locator(".toast-container").getByText(/Annotation (un)?scratched/i)).toBeVisible({ timeout: 10000 });
  }

  async isCurrentAnnotationScratched(): Promise<boolean> {
    const classAttr = await this.annotationItem().getByTitle("Scratch off").getAttribute("class");
    return classAttr?.includes("active") ?? false;
  }

  async deleteCurrentAnnotation(): Promise<void> {
    this.page.once("dialog", dialog => dialog.accept());
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/step-annotations/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.annotationItem().getByTitle("Delete annotation").click();
    await refreshWait;
  }

  async toggleHideScratched(): Promise<void> {
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/step-annotations/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator("#hideScratched").click();
    await refreshWait;
  }

  async goToNextAnnotation(): Promise<void> {
    await this.page.getByRole("button", { name: "Next" }).click();
  }

  async goToPreviousAnnotation(): Promise<void> {
    await this.page.getByRole("button", { name: "Previous" }).click();
  }

  async getAnnotationPositionText(): Promise<string> {
    return this.page.getByRole("button", { name: "Previous" }).locator("xpath=../..").locator(".text-muted.small").innerText();
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

  async addCalculatorAnnotation(): Promise<void> {
    await this.page.getByRole("button", { name: /^Add( Annotation)?$/ }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Add Annotation");
    await this.page.locator('label[for="modeCalculator"]').click();

    await this.page.getByRole("button", { name: "7", exact: true }).click();
    await this.page.getByRole("button", { name: "+", exact: true }).click();
    await this.page.getByRole("button", { name: "3", exact: true }).click();
    await this.page.getByRole("button", { name: "=", exact: true }).click();

    const postWait = this.page.waitForResponse(resp => resp.url().includes("/step-annotations/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Save" }).click();
    await postWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async addMolarityDilutionAnnotation(): Promise<void> {
    await this.page.getByRole("button", { name: /^Add( Annotation)?$/ }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Add Annotation");
    await this.page.locator('label[for="modeMolarity"]').click();

    const molarityComponent = this.page.locator("app-molarity-calculator-annotation");
    await molarityComponent.locator("select").first().selectOption("volumeFromStockVolumeAndConcentration");
    const inputs = molarityComponent.locator('input[type="number"]');
    await inputs.nth(0).fill("10");
    await inputs.nth(1).fill("100");
    await inputs.nth(2).fill("1");
    await this.page.getByRole("button", { name: /Calculate Final Volume/i }).click();

    const postWait = this.page.waitForResponse(resp => resp.url().includes("/step-annotations/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Save" }).click();
    await postWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async addInstrumentBookingAnnotation(instrumentName: string): Promise<void> {
    await this.page.getByRole("button", { name: /^Add( Annotation)?$/ }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Add Annotation");
    await this.page.locator('label[for="modeBook"]').click();

    await this.page.locator("#instrumentSelect").selectOption({ label: instrumentName });

    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const toLocal = (d: Date) => d.toISOString().slice(0, 16);
    await this.page.locator("#startDateTime").fill(toLocal(start));
    await this.page.locator("#endDateTime").fill(toLocal(end));

    const linkWait = this.page.waitForResponse(resp => resp.url().includes("/instrument-usage-step-annotations/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Save" }).click();
    await linkWait;
    await expect(this.page.locator(".toast-container").getByText("Instrument booked and linked to step")).toBeVisible({ timeout: 10000 });
  }

  async recordAudioAnnotation(durationMs = 1500): Promise<void> {
    await this.page.getByRole("button", { name: /^Add( Annotation)?$/ }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Add Annotation");
    await this.page.locator('label[for="modeRecord"]').click();

    await expect(this.page.locator("#audioDevice option").first()).not.toHaveText("No microphones detected", { timeout: 10000 });
    await this.page.getByRole("button", { name: "Start Recording" }).click();
    await this.page.waitForTimeout(durationMs);
    await this.page.getByRole("button", { name: "Stop Recording" }).click();
    await expect(this.page.getByText("Recording complete")).toBeVisible({ timeout: 10000 });

    const postWait = this.page.waitForResponse(resp => resp.url().includes("/upload/step-annotation-chunks/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Save" }).click();
    await postWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async addSketchAnnotation(): Promise<void> {
    await this.page.getByRole("button", { name: /^Add( Annotation)?$/ }).click();
    await expect(this.page.locator(".modal-title")).toContainText("Add Annotation");
    await this.page.locator('label[for="modeSketch"]').click();

    const canvas = this.page.locator("app-sketch-annotation canvas");
    await expect(canvas).toBeVisible({ timeout: 10000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Sketch canvas has no bounding box");

    await this.page.mouse.move(box.x + 20, box.y + 20);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 100, box.y + 100, { steps: 10 });
    await this.page.mouse.move(box.x + 180, box.y + 40, { steps: 10 });
    await this.page.mouse.up();

    const postWait = this.page.waitForResponse(resp => resp.url().includes("/upload/step-annotation-chunks/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary", { hasText: "Save" }).click();
    await postWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async expectSketchAnnotationVisible(): Promise<void> {
    await expect(this.annotationItem().locator("canvas")).toBeVisible({ timeout: 10000 });
  }
}
