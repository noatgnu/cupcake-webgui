import * as fs from "fs";
import * as path from "path";
import { test, expect } from "../fixtures/auth";
import { ProtocolEditorPage } from "../page-objects/cupcake/protocol-editor.po";
import { SessionDetailPage } from "../page-objects/cupcake/session-detail.po";
import { StoragePage } from "../page-objects/cupcake/storage.po";
import { InstrumentsPage } from "../page-objects/cupcake/instruments.po";

const adminAuthState = path.join(__dirname, "../auth-states/admin.json");
const PROTOCOL_TITLE = `E2E Session Protocol ${Date.now()}`;

test.describe("sessions", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180000);
    const ctx = await browser.newContext({
      storageState: adminAuthState,
    });
    const page = await ctx.newPage();
    const editor = new ProtocolEditorPage(page);
    await editor.gotoList();
    await editor.createProtocol(PROTOCOL_TITLE);
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
    test.setTimeout(120000);
    const session = new SessionDetailPage(adminPage);
    await session.gotoList();
    await session.createFromProtocol(PROTOCOL_TITLE);
    await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
  });

  test("session detail shows steps", async ({ adminPage }) => {
    test.setTimeout(120000);
    const session = new SessionDetailPage(adminPage);
    await session.gotoList();
    await session.createFromProtocol(PROTOCOL_TITLE);
    await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
    await expect(adminPage.getByText("Step 1").first()).toBeVisible({ timeout: 10000 });
  });

  test.describe("session step timers", () => {
    test("start timer shows pause button", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await expect(adminPage.getByTitle("Pause Timer")).toBeVisible();
      await expect(adminPage.getByTitle("Start Timer")).not.toBeVisible();
    });

    test("timer countdown decreases after start", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      const initial = await session.getStepTimerDisplay();
      await adminPage.waitForTimeout(2500);
      const after = await session.getStepTimerDisplay();
      expect(after).not.toBe(initial);
    });

    test("pause timer shows start button and stops countdown", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await adminPage.waitForTimeout(1500);
      await session.pauseStepTimer();
      const pausedValue = await session.getStepTimerDisplay();
      await adminPage.waitForTimeout(2000);
      const afterWait = await session.getStepTimerDisplay();
      expect(afterWait).toBe(pausedValue);
    });

    test("resume paused timer continues countdown", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await adminPage.waitForTimeout(1500);
      await session.pauseStepTimer();
      const pausedValue = await session.getStepTimerDisplay();
      await session.startStepTimer();
      await adminPage.waitForTimeout(2500);
      const afterResume = await session.getStepTimerDisplay();
      expect(afterResume).not.toBe(pausedValue);
    });

    test("reset timer restores full duration and shows start button", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await adminPage.waitForTimeout(2000);
      await session.pauseStepTimer();
      await session.resetStepTimer();
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 5000 });
      const resetDisplay = await session.getStepTimerDisplay();
      expect(resetDisplay).toMatch(/00:10:0[01]/);
    });

    test("start after reset begins countdown from full duration", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByTitle("Start Timer")).toBeVisible({ timeout: 10000 });
      await session.startStepTimer();
      await adminPage.waitForTimeout(2000);
      await session.pauseStepTimer();
      await session.resetStepTimer();
      await session.startStepTimer();
      const initial = await session.getStepTimerDisplay();
      await adminPage.waitForTimeout(2500);
      const after = await session.getStepTimerDisplay();
      expect(after).not.toBe(initial);
      await expect(adminPage.getByTitle("Pause Timer")).toBeVisible();
    });
  });

  test.describe("reagent booking", () => {
    const BOOKING_PROTOCOL_TITLE = `E2E Booking Protocol ${Date.now()}`;
    const BOOKING_STEP_DESCRIPTION = `Booking step ${Date.now()}`;
    const BOOKING_REAGENT_NAME = `E2E Booking Reagent ${Date.now()}`;
    const BOOKING_FREEZER_NAME = `E2E Booking Freezer ${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(180000);
      const ctx = await browser.newContext({ storageState: adminAuthState });
      const page = await ctx.newPage();

      const editor = new ProtocolEditorPage(page);
      await editor.gotoList();
      await editor.createProtocol(BOOKING_PROTOCOL_TITLE);
      await editor.addSection("Section 1");
      await editor.addStep("Section 1", BOOKING_STEP_DESCRIPTION, 5);
      await editor.addStepReagent(BOOKING_STEP_DESCRIPTION, BOOKING_REAGENT_NAME, "uL", 10);

      const storage = new StoragePage(page);
      await storage.goto();
      await storage.create(BOOKING_FREEZER_NAME);
      await storage.open(BOOKING_FREEZER_NAME);
      await storage.addReagent(BOOKING_REAGENT_NAME, 50, "uL");

      await page.context().close();
    });

    test("booking a reagent from storage shows the booked quantity on the step", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(BOOKING_PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });
      await expect(adminPage.getByText(BOOKING_STEP_DESCRIPTION)).toBeVisible({ timeout: 10000 });

      await session.bookReagent(BOOKING_REAGENT_NAME, BOOKING_FREEZER_NAME, 10);

      const bookedText = await session.getStepReagentBookedText(BOOKING_REAGENT_NAME);
      expect(bookedText).toContain("Booked:");
      expect(bookedText).toContain("10");
    });
  });

  test.describe("step annotations", () => {
    test("adding a text annotation shows it as the current annotation", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      const annotationText = `E2E annotation ${Date.now()}`;
      await session.addTextAnnotation(annotationText);

      const displayedText = await session.getCurrentAnnotationText();
      expect(displayedText).toBe(annotationText);
    });
  });

  test.describe("session export", () => {
    test("exporting a session as HTML downloads a file containing the step and its annotation", async ({ adminPage }) => {
      test.setTimeout(120000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      const annotationText = `E2E export annotation ${Date.now()}`;
      await session.addTextAnnotation(annotationText);

      const download = await session.exportSessionHtml();
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();

      const content = fs.readFileSync(downloadPath as string, "utf-8");
      expect(content).toContain('class="step-description"');
      expect(content).toContain(annotationText);
    });
  });

  test.describe("audio and video transcription", () => {
    const voiceSamplePath = process.env["E2E_VOICE_SAMPLE_PATH"];
    const voiceVideoPath = process.env["E2E_VOICE_VIDEO_PATH"];

    test("uploading an audio annotation transcribes it via whisper.cpp", async ({ adminPage }) => {
      test.skip(!voiceSamplePath || !fs.existsSync(voiceSamplePath), "No voice sample fixture configured (set E2E_VOICE_SAMPLE_PATH; CI generates one via espeak-ng)");
      test.setTimeout(180000);

      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.uploadFileAnnotation(voiceSamplePath as string);
      expect(await session.getCurrentAnnotationTypeLabel()).toBe("Audio");
      await session.waitForTranscriptionCompleted();

      const cueText = await session.getTranscriptionCueText();
      expect(cueText.trim().length).toBeGreaterThan(0);
    });

    test("uploading a video annotation with the same speech produces a transcription too", async ({ adminPage }) => {
      test.skip(!voiceVideoPath || !fs.existsSync(voiceVideoPath), "No voice video fixture configured (set E2E_VOICE_VIDEO_PATH; CI generates one via ffmpeg)");
      test.setTimeout(180000);

      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.uploadFileAnnotation(voiceVideoPath as string);
      expect(await session.getCurrentAnnotationTypeLabel()).toBe("Video");
      await session.expectVideoAnnotationVisible();
      await session.waitForTranscriptionCompleted();

      const cueText = await session.getTranscriptionCueText();
      expect(cueText.trim().length).toBeGreaterThan(0);
    });
  });

  test.describe("image and document annotation upload", () => {
    const imagePath = process.env["E2E_IMAGE_PATH"];
    const documentPath = process.env["E2E_DOCUMENT_PATH"];

    test("uploading an image annotation displays it inline", async ({ adminPage }) => {
      test.skip(!imagePath || !fs.existsSync(imagePath), "No image fixture configured (set E2E_IMAGE_PATH)");
      test.setTimeout(60000);

      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.uploadFileAnnotation(imagePath as string);
      expect(await session.getCurrentAnnotationTypeLabel()).toBe("Image");
      await session.expectImageAnnotationVisible();
    });

    test("uploading a generic document annotation with descriptive text", async ({ adminPage }) => {
      test.skip(!documentPath || !fs.existsSync(documentPath), "No document fixture configured (set E2E_DOCUMENT_PATH)");
      test.setTimeout(60000);

      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      const description = `E2E document description ${Date.now()}`;
      await session.uploadFileAnnotation(documentPath as string, description);

      await expect(adminPage.locator(".annotation-item")).toContainText(description, { timeout: 10000 });
    });
  });

  test.describe("calculator annotations", () => {
    test("calculator mode saves a history entry as an annotation", async ({ adminPage }) => {
      test.setTimeout(60000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.addCalculatorAnnotation();
      expect(await session.getCurrentAnnotationTypeLabel()).toBe("calculator");
      await expect(adminPage.locator(".annotation-item")).toContainText("10", { timeout: 10000 });
    });

    test("molarity dilution mode saves a history entry as an annotation", async ({ adminPage }) => {
      test.setTimeout(60000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.addMolarityDilutionAnnotation();
      expect(await session.getCurrentAnnotationTypeLabel()).toBe("mcalculator");
    });
  });

  test.describe("instrument booking annotation", () => {
    const BOOKING_ANNOTATION_INSTRUMENT = `E2E Annotation Instrument ${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(60000);
      const ctx = await browser.newContext({ storageState: adminAuthState });
      const page = await ctx.newPage();
      const instruments = new InstrumentsPage(page);
      await instruments.goto();
      await instruments.create(BOOKING_ANNOTATION_INSTRUMENT);
      await page.context().close();
    });

    test("booking an instrument from the annotation modal links it to the step", async ({ adminPage }) => {
      test.setTimeout(60000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.addInstrumentBookingAnnotation(BOOKING_ANNOTATION_INSTRUMENT);
      expect(await session.getCurrentAnnotationTypeLabel()).toBe("booking");
    });
  });

  test.describe("recorded audio annotation", () => {
    test("recording audio via the fake media device saves an audio annotation", async ({ adminPage }) => {
      test.setTimeout(60000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.recordAudioAnnotation();
      expect(await session.getCurrentAnnotationTypeLabel()).toBe("Audio");
    });
  });

  test.describe("sketch annotation", () => {
    test("drawing a sketch saves it and renders on a canvas", async ({ adminPage }) => {
      test.setTimeout(60000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.addSketchAnnotation();
      await session.expectSketchAnnotationVisible();
    });
  });

  test.describe("annotation management", () => {
    test("scratching, unscratching and hiding scratched annotations", async ({ adminPage }) => {
      test.setTimeout(60000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.addTextAnnotation(`E2E scratch annotation ${Date.now()}`);
      expect(await session.isCurrentAnnotationScratched()).toBe(false);

      await session.toggleScratchCurrentAnnotation();
      expect(await session.isCurrentAnnotationScratched()).toBe(true);

      await session.toggleHideScratched();
      await expect(adminPage.locator(".annotation-item")).not.toBeVisible({ timeout: 10000 });

      await session.toggleHideScratched();
      await expect(adminPage.locator(".annotation-item")).toBeVisible({ timeout: 10000 });
    });

    test("previous/next navigation moves between multiple annotations", async ({ adminPage }) => {
      test.setTimeout(60000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      await session.addTextAnnotation(`E2E nav annotation 1 ${Date.now()}`);
      await session.addTextAnnotation(`E2E nav annotation 2 ${Date.now()}`);

      expect(await session.getAnnotationPositionText()).toContain("1 of");
      await session.goToNextAnnotation();
      expect(await session.getAnnotationPositionText()).toContain("2 of");
      await session.goToPreviousAnnotation();
      expect(await session.getAnnotationPositionText()).toContain("1 of");
    });

    test("deleting an annotation removes it", async ({ adminPage }) => {
      test.setTimeout(60000);
      const session = new SessionDetailPage(adminPage);
      await session.gotoList();
      await session.createFromProtocol(PROTOCOL_TITLE);
      await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 15000 });

      const annotationText = `E2E delete annotation ${Date.now()}`;
      await session.addTextAnnotation(annotationText);
      await expect(adminPage.locator(".annotation-item")).toContainText(annotationText, { timeout: 10000 });

      await session.deleteCurrentAnnotation();
      await expect(adminPage.getByText(annotationText)).not.toBeVisible({ timeout: 10000 });
    });
  });
});
