import { Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

const SETTLED_SCRIPT = async () => {
  await document.fonts.ready;
  const running = document.getAnimations().filter(
    animation => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity
  );
  await Promise.all(running.map(animation => animation.finished.catch(() => undefined)));
  await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
};

interface Shot {
  name: string;
  lineup: string;
  file: string;
  caption: string;
}

/**
 * Save the page for the documentation when CUPCAKE_SCREENSHOTS_DIR is set, once fonts are loaded and transitions
 * have finished. The screenshot is written to <dir>/<lineup>/<name>.png and listed in <dir>/manifest.json, the
 * same manifest the client tests write.
 */
export async function screenshot(page: Page, lineup: string, name: string, caption: string): Promise<void> {
  const directory = process.env['CUPCAKE_SCREENSHOTS_DIR'];
  if (!directory) {
    return;
  }
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.evaluate(SETTLED_SCRIPT);
  const file = `${lineup}/${name}.png`;
  const path = join(directory, file);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: 'disabled' });
  recordScreenshot(directory, { name, lineup, file, caption });
}

/**
 * Save a window of the running app, found by its title on X display, for the documentation when
 * CUPCAKE_SCREENSHOTS_DIR is set.
 */
export function captureWindow(display: number, title: string, lineup: string, name: string, caption: string): void {
  const directory = process.env['CUPCAKE_SCREENSHOTS_DIR'];
  if (!directory) {
    return;
  }
  const file = `${lineup}/${name}.png`;
  const path = join(directory, file);
  mkdirSync(dirname(path), { recursive: true });
  execFileSync('import', ['-display', `:${display}`, '-window', title, path]);
  recordScreenshot(directory, { name, lineup, file, caption });
}

function recordScreenshot(directory: string, shot: Shot): void {
  const { file } = shot;
  const manifestFile = join(directory, 'manifest.json');
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : { screenshots: [] };
  const kept: Shot[] = (manifest.screenshots ?? []).filter((shot: Shot) => shot.file !== file && existsSync(join(directory, shot.file)));
  manifest.label = process.env['CUPCAKE_SCREENSHOTS_LABEL'] ?? manifest.label ?? null;
  manifest.taken = new Date().toISOString();
  manifest.screenshots = [...kept, shot].sort((a, b) =>
    a.lineup === b.lineup ? a.name.localeCompare(b.name) : a.lineup.localeCompare(b.lineup)
  );
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
}
