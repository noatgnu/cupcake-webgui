import fs from "fs";
import path from "path";
import { request as playwrightRequest } from "@playwright/test";
import { test, expect } from "../fixtures/auth";

const API_BASE = process.env["API_URL"] || "http://localhost:8000";
const BASE_URL = process.env["CUPCAKE_URL"] || "http://localhost:4201";
let sessionUrl = "";

test.describe("WebRTC live session panel", () => {
  test.beforeAll(async () => {
    test.setTimeout(30000);
    const storageState = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../auth-states/admin.json"), "utf-8")
    );
    const token = storageState.origins?.[0]?.localStorage
      ?.find((item: { name: string; value: string }) => item.name === "ccvAccessToken")?.value;
    if (!token) throw new Error("Admin auth token not found in storage state");

    const api = await playwrightRequest.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const protocolRes = await api.post("/api/protocol/", {
      headers: { "Content-Type": "application/json" },
      data: { protocol_title: `E2E WebRTC Protocol ${Date.now()}`, protocol_description: "" },
    });
    const protocol = await protocolRes.json();

    const sessionRes = await api.post("/api/session/", {
      headers: { "Content-Type": "application/json" },
      data: { name: `E2E WebRTC Session ${Date.now()}`, protocols: [protocol.id], enabled: true },
    });
    const session = await sessionRes.json();
    await api.dispose();

    sessionUrl = `${BASE_URL}/#/protocols/sessions/${session.id}`;
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

  test("chat input accepts and holds text", async ({ adminPage }) => {
    await adminPage.goto(sessionUrl);
    await expect(adminPage).toHaveURL(/\/protocols\/sessions\/\d+/, { timeout: 10000 });
    await adminPage.getByRole("button", { name: /live session/i }).click();
    await expect(adminPage.locator(".webrtc-panel")).toBeVisible({ timeout: 5000 });
    await adminPage.locator(".webrtc-panel").getByTitle("Chat").click();
    await expect(adminPage.locator(".panel-chat")).toBeVisible({ timeout: 5000 });
    const chatInput = adminPage.locator(".chat-input-container input[type='text']");
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("E2E test message");
    await expect(chatInput).toHaveValue("E2E test message");
  });
});
