import { Locator } from "@playwright/test";

/**
 * Fills a locator and verifies the value actually stuck, re-filling if not.
 *
 * Guards against a race in freshly-opened ng-bootstrap modals: the first form interaction can
 * be set correctly by Playwright's fill(), then get silently reverted to empty shortly after by
 * Angular's reactive-forms value accessor before the component has fully settled. A plain
 * `.fill()` plus a `.modal-title` wait reduces this but does not eliminate it. Confirmed via a
 * MutationObserver-based repro that the clear happens within tens of milliseconds of the fill.
 */
export async function fillReliably(locator: Locator, value: string, attempts = 5): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    await locator.fill(value);
    await locator.page().waitForTimeout(150);
    if ((await locator.inputValue()) === value) return;
  }
  throw new Error(`fillReliably: value did not stick after ${attempts} attempts: ${value}`);
}
