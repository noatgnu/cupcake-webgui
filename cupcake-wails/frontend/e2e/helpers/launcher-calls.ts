import { Page } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export type LauncherAnswer = unknown | ((args: unknown[]) => unknown);

export interface LauncherCall {
  method: string;
  args: unknown[];
}

/** A launcher method whose answer is an error, as the Go method returning an error. */
export class LauncherError {
  constructor(readonly message: string) {}
}

function findAppBindings(folder: string): string {
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) {
      const found = findAppBindings(path);
      if (found) {
        return found;
      }
    } else if (entry === 'app.ts' && readFileSync(path, 'utf8').includes('$Call.ByID(')) {
      return path;
    }
  }
  return '';
}

/** The launcher method names by their binding ID, read from the generated bindings. */
export function launcherMethodIds(): Map<number, string> {
  const bindings = findAppBindings(join(__dirname, '..', '..', 'bindings'));
  const source = readFileSync(bindings, 'utf8');
  const ids = new Map<number, string>();
  for (const match of source.matchAll(/export function (\w+)\([^)]*\)[\s\S]*?\$Call\.ByID\((\d+)/g)) {
    ids.set(Number(match[2]), match[1]);
  }
  const declared = source.match(/export function \w+\(/g)?.length ?? 0;
  if (ids.size !== declared) {
    throw new Error(`Read ${ids.size} launcher method IDs from ${bindings}, but it declares ${declared} methods`);
  }
  return ids;
}

/**
 * Run the launcher's windows in a browser: the page counts as a Wails window, launcher events go through the
 * Playwright mock, and launcher method calls are answered from answers. Returns the calls made, in order.
 */
export async function fakeLauncher(page: Page, answers: Record<string, LauncherAnswer>): Promise<LauncherCall[]> {
  const ids = launcherMethodIds();
  const calls: LauncherCall[] = [];
  await page.addInitScript(() => {
    (window as any)._wails = (window as any)._wails || {};
  });
  await page.route('**/wails/runtime', async route => {
    const body = route.request().postDataJSON() ?? {};
    const options = body.args ?? {};
    const method = options.methodName
      ? String(options.methodName).split('.').pop()
      : ids.get(Number(options.methodID)) ?? `unknown-${options.methodID}`;
    const args: unknown[] = options.args ?? [];
    calls.push({ method, args });
    const answer = answers[method];
    const value = typeof answer === 'function' ? (answer as (args: unknown[]) => unknown)(args) : answer;
    if (value instanceof LauncherError) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ kind: 'RuntimeError', message: value.message }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value ?? null) });
  });
  return calls;
}
