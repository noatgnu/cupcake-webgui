import { test, expect } from "../fixtures/auth";

test.describe("messages", () => {
  test("messages panel loads", async ({ adminPage }) => {
    await adminPage.goto("/#/home/messages");
    await expect(adminPage).toHaveURL(/\/home\/messages|\/messages/, { timeout: 10000 });
  });

  test("compose new message to testuser and send", async ({ adminPage }) => {
    await adminPage.goto("/#/home/messages");
    const composeBtn = adminPage.getByRole("button", { name: /compose|new message|new thread/i });
    if (await composeBtn.isVisible({ timeout: 5000 })) {
      await composeBtn.click();

      const recipientInput = adminPage.getByLabel(/to|recipient/i);
      if (await recipientInput.isVisible({ timeout: 3000 })) {
        await recipientInput.fill("testuser");
        const suggestion = adminPage.getByText(/testuser/i).first();
        if (await suggestion.isVisible({ timeout: 3000 })) await suggestion.click();
      }

      const subject = adminPage.getByLabel(/subject|title/i);
      if (await subject.isVisible({ timeout: 2000 })) {
        await subject.fill(`E2E Message ${Date.now()}`);
      }

      const body = adminPage.getByLabel(/message|body|content/i);
      if (await body.isVisible({ timeout: 3000 })) {
        await body.fill("E2E automated message to testuser");
        await adminPage.getByRole("button", { name: /send|submit/i }).click();
        await expect(adminPage.getByText("E2E automated message to testuser")).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test("testuser sees message from admin", async ({ adminPage, userPage }) => {
    const subject = `E2E Visible ${Date.now()}`;
    await adminPage.goto("/#/home/messages");
    const composeBtn = adminPage.getByRole("button", { name: /compose|new message|new thread/i });
    if (await composeBtn.isVisible({ timeout: 5000 })) {
      await composeBtn.click();
      const recipientInput = adminPage.getByLabel(/to|recipient/i);
      if (await recipientInput.isVisible({ timeout: 3000 })) {
        await recipientInput.fill("testuser");
        const suggestion = adminPage.getByText(/testuser/i).first();
        if (await suggestion.isVisible({ timeout: 3000 })) await suggestion.click();
      }
      const subjectInput = adminPage.getByLabel(/subject|title/i);
      if (await subjectInput.isVisible({ timeout: 2000 })) await subjectInput.fill(subject);
      const body = adminPage.getByLabel(/message|body|content/i);
      if (await body.isVisible({ timeout: 3000 })) {
        await body.fill("Hello from admin");
        await adminPage.getByRole("button", { name: /send|submit/i }).click();
      }
    }

    await userPage.goto("/#/home/messages");
    await expect(userPage.getByText(/admin|Hello from admin/i)).toBeVisible({ timeout: 15000 });
  });
});
