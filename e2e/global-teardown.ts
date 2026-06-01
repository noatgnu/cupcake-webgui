/**
 * Playwright global teardown for cupcake E2E tests.
 * The backend lifecycle is managed separately in cupcake_vanilla.
 */
import { FullConfig } from "@playwright/test";

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  // Backend is managed externally; nothing to tear down here.
}
