/**
 * Page object for storage management (/storage).
 */
import { Page, expect } from "@playwright/test";

export class StoragePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/#/storage");
  }

  async create(name: string): Promise<void> {
    await this.page.getByRole("button", { name: "Add Storage" }).click();
    await this.page.locator("#name").fill(name);
    const postWait = this.page.waitForResponse(resp => resp.url().includes("/storage-objects/") && resp.request().method() === "POST", { timeout: 30000 });
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/storage-objects/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await postWait;
    await refreshWait;
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async open(name: string): Promise<void> {
    await this.page.getByText(name).first().click();
  }

  async addReagent(name: string, qty: number, unit: string): Promise<void> {
    await this.page.getByTitle("Add Reagent").click();
    await this.page.locator("#reagentName").fill(name);
    await this.page.locator("#quantity").fill(String(qty));
    await this.page.locator("#reagentUnit").selectOption(unit);
    const postWait = this.page.waitForResponse(resp => resp.url().includes("/stored-reagents/") && resp.request().method() === "POST", { timeout: 30000 });
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/stored-reagents/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await postWait;
    await refreshWait;
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async expectReagentVisible(name: string): Promise<void> {
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 10000 });
  }

  async createChildStorage(name: string): Promise<void> {
    await this.page.getByTitle("Add child storage").click();
    await this.page.locator("#name").fill(name);
    const postWait = this.page.waitForResponse(resp => resp.url().includes("/storage-objects/") && resp.request().method() === "POST", { timeout: 30000 });
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/storage-objects/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await postWait;
    await refreshWait;
    await expect(this.page.locator(".storage-panel-left").getByText(name)).toBeVisible({ timeout: 10000 });
  }

  reagentRow(reagentName: string) {
    return this.page.locator(".storage-panel-right .list-group-item").filter({ hasText: reagentName });
  }

  async addQuantity(reagentName: string, qty: number, notes?: string): Promise<void> {
    await this.reagentRow(reagentName).getByTitle("Add Quantity").click();
    await this.page.locator("#quantity").fill(String(qty));
    if (notes) {
      await this.page.locator("#notes").fill(notes);
    }
    await Promise.all([
      this.page.waitForResponse(resp => resp.url().includes("/stored-reagents/") && resp.request().method() === "GET", { timeout: 30000 }),
      this.page.locator(".modal-footer .btn-primary").click(),
    ]);
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async reserveQuantity(reagentName: string, qty: number, notes?: string): Promise<void> {
    await this.reagentRow(reagentName).getByTitle("Reserve Quantity").click();
    await this.page.locator("#quantity").fill(String(qty));
    if (notes) {
      await this.page.locator("#notes").fill(notes);
    }
    await Promise.all([
      this.page.waitForResponse(resp => resp.url().includes("/stored-reagents/") && resp.request().method() === "GET", { timeout: 30000 }),
      this.page.locator(".modal-footer .btn-danger").click(),
    ]);
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async getReagentRowText(reagentName: string): Promise<string> {
    return this.reagentRow(reagentName).innerText();
  }

  async searchReagents(term: string): Promise<void> {
    await this.page.getByPlaceholder("Search reagents...").fill(term);
  }

  async openEditReagentModal(reagentName: string): Promise<void> {
    await this.reagentRow(reagentName).getByTitle("Edit").click();
    await expect(this.page.locator(".modal-title")).toContainText("Edit Stored Reagent");
  }

  async setLowStockNotification(reagentName: string, opts: { threshold?: number; notify: boolean }): Promise<void> {
    await this.openEditReagentModal(reagentName);
    if (opts.threshold !== undefined) {
      await this.page.locator("#lowStockThreshold").fill(String(opts.threshold));
    }
    await this.page.locator("#notifyOnLowStock").setChecked(opts.notify);
    const putWait = this.page.waitForResponse(resp => /\/stored-reagents\/\d+\/$/.test(resp.url()) && resp.request().method() === "PUT", { timeout: 30000 });
    const refreshWait = this.page.waitForResponse(resp => resp.url().includes("/stored-reagents/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await putWait;
    await refreshWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async isNotifyOnLowStockChecked(reagentName: string): Promise<boolean> {
    await this.openEditReagentModal(reagentName);
    const checked = await this.page.locator("#notifyOnLowStock").isChecked();
    await this.page.getByRole("button", { name: "Cancel" }).click();
    return checked;
  }

  async sendTestNotification(reagentName: string, alertType: "low_stock" | "expired" | "expiring_soon"): Promise<void> {
    await this.openEditReagentModal(reagentName);
    await this.page.locator("#notificationType").selectOption(alertType);
    const postWait = this.page.waitForResponse(resp => resp.url().includes("/send_test_notification/") && resp.request().method() === "POST", { timeout: 30000 });
    await this.page.getByRole("button", { name: "Send Test" }).click();
    await postWait;
  }

  toast(message: string) {
    return this.page.locator(".toast-container").getByText(message);
  }

  /**
   * Checks the checkbox for a lab group inside an access modal's paginated
   * list, paging forward if the lab group isn't on the current page.
   */
  private async checkLabGroupInAccessModal(labGroupName: string): Promise<void> {
    const maxPages = 20;
    for (let i = 0; i < maxPages; i++) {
      const row = this.page.locator(".list-group-item").filter({ hasText: labGroupName });
      if (await row.isVisible({ timeout: i === 0 ? 10000 : 2000 }).catch(() => false)) {
        await row.locator('input[type="checkbox"]').check();
        return;
      }
      const nextButton = this.page.getByRole("button", { name: "Next" });
      if (await nextButton.isDisabled().catch(() => true)) break;
      await nextButton.click();
    }
    throw new Error(`Lab group "${labGroupName}" not found in access modal list`);
  }

  async shareStorageWithLabGroup(labGroupName: string): Promise<void> {
    const labGroupsWait = this.page.waitForResponse(resp => resp.url().includes("/lab-groups/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.page.locator(".storage-panel-right .card-header").getByTitle("Manage Access").click();
    await expect(this.page.locator(".modal-title")).toContainText("Manage Access Permissions");
    await labGroupsWait;
    await this.checkLabGroupInAccessModal(labGroupName);
    const putWait = this.page.waitForResponse(resp => /\/storage-objects\/\d+\/$/.test(resp.url()) && resp.request().method() === "PUT", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await putWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }

  async shareReagentWithLabGroup(reagentName: string, labGroupName: string): Promise<void> {
    const labGroupsWait = this.page.waitForResponse(resp => resp.url().includes("/lab-groups/") && resp.request().method() === "GET", { timeout: 30000 });
    await this.reagentRow(reagentName).getByTitle("Manage Access").click();
    await expect(this.page.locator(".modal-title")).toContainText("Manage Reagent Access");
    if (!(await this.page.locator("#shareableSwitch").isChecked())) {
      await this.page.locator("#shareableSwitch").check();
    }
    await this.page.getByRole("button", { name: "Lab Groups" }).click();
    await labGroupsWait;
    await this.checkLabGroupInAccessModal(labGroupName);
    const putWait = this.page.waitForResponse(resp => /\/stored-reagents\/\d+\/$/.test(resp.url()) && resp.request().method() === "PUT", { timeout: 30000 });
    await this.page.locator(".modal-footer .btn-primary").click();
    await putWait;
    await expect(this.page.locator(".modal-title")).not.toBeVisible({ timeout: 10000 });
  }
}
