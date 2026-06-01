import { test, expect } from "../fixtures/auth";

test.describe("home dashboard", () => {
  test("/home loads for admin", async ({ adminPage }) => {
    await adminPage.goto("/#/home");
    await expect(adminPage).toHaveURL(/\/home/, { timeout: 10000 });
  });

  test("user profile shows admin info", async ({ adminPage }) => {
    await adminPage.goto("/#/home/profile");
    await expect(adminPage.getByText(/admin|admin@cupcake\.local/i)).toBeVisible({ timeout: 10000 });
  });

  test("create project appears in list", async ({ adminPage }) => {
    const name = `E2E Project ${Date.now()}`;
    await adminPage.goto("/#/home/projects");
    await adminPage.getByRole("button", { name: /new|create|add project/i }).click();
    await adminPage.getByLabel(/name|title/i).fill(name);
    await adminPage.getByRole("button", { name: /save|create|confirm/i }).click();
    await expect(adminPage.getByText(name)).toBeVisible({ timeout: 10000 });
  });

  test("create lab group from home and it appears in list", async ({ adminPage }) => {
    const name = `E2E Home Lab ${Date.now()}`;
    await adminPage.goto("/#/home/lab-groups");
    await adminPage.getByRole("button", { name: /new|create|add/i }).click();
    await adminPage.getByLabel(/name/i).fill(name);
    await adminPage.getByRole("button", { name: /save|create|confirm/i }).click();
    await expect(adminPage.getByText(name)).toBeVisible({ timeout: 10000 });
  });
});
