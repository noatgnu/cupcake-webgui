/**
 * Minimal client for the Wails v3 built-in MCP server (`-tags mcp`).
 *
 * The server speaks JSON-RPC 2.0 over a single HTTP POST endpoint. Every
 * window-scoped helper accepts an optional window name matching the names
 * assigned in app.go/main.go (splash, downloader, superuser, main, ...).
 */

const MCP_URL = process.env['MCP_URL'] || 'http://127.0.0.1:9099/mcp';

let nextId = 1;

interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
}

export interface McpWindow {
  id: number;
  name: string;
  visible: boolean;
  focused: boolean;
}

async function rpc(method: string, params?: object): Promise<any> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  const body = await response.json();
  if (body.error) {
    throw new Error(`MCP ${method} failed: ${body.error.message}`);
  }
  return body.result;
}

function parseToolResult(result: McpToolResult): any {
  const text = result.content.map(c => c.text).join('');
  if (result.isError) {
    throw new Error(`MCP tool call failed: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function withWindow(args: Record<string, any>, window?: string): Record<string, any> {
  return window ? { ...args, window } : args;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callTool(name: string, args: Record<string, any> = {}): Promise<any> {
  const result = await rpc('tools/call', { name, arguments: args });
  return parseToolResult(result);
}

export async function listTools(): Promise<string[]> {
  const result = await rpc('tools/list');
  return result.tools.map((t: { name: string }) => t.name);
}

export async function windows(): Promise<McpWindow[]> {
  return callTool('windows_list');
}

export async function waitForWindow(name: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const found = (await windows()).find(w => w.name === name);
      if (found?.visible) return true;
    } catch {
      await sleep(1000);
      continue;
    }
    await sleep(1000);
  }
  return false;
}

export async function waitForWindowClosed(name: string, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = (await windows()).find(w => w.name === name);
    if (!found) return true;
    await sleep(1000);
  }
  return false;
}

export async function evaluate(js: string, window?: string): Promise<any> {
  return callTool('js_eval', withWindow({ js }, window));
}

export async function getUrl(window?: string): Promise<string> {
  return evaluate('return window.location.href;', window);
}

export async function click(selector: string, window?: string): Promise<void> {
  await callTool('mouse_click', withWindow({ selector }, window));
}

/**
 * Clicks a dialog button until goneSelector disappears; clicks that land while a dialog is still
 * animating open are ignored by the page, so a single click is not enough.
 */
export async function clickUntilGone(buttonSelector: string, goneSelector: string, window?: string, attempts = 5): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (!(await elementExists(goneSelector, window))) return true;
    if (await elementExists(buttonSelector, window)) {
      await click(buttonSelector, window);
    }
    const closed = await waitFor(async () => !(await elementExists(goneSelector, window)), 3000, 300);
    if (closed) return true;
  }
  return !(await elementExists(goneSelector, window));
}

/**
 * Clicks a button until appearSelector shows up, for buttons that open menus or dialogs and
 * whose first click can be swallowed while the page is still re-rendering.
 */
export async function clickUntilPresent(buttonSelector: string, appearSelector: string, window?: string, attempts = 5): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await elementExists(appearSelector, window)) return true;
    if (await elementExists(buttonSelector, window)) {
      await click(buttonSelector, window);
    }
    if (await waitForElement(appearSelector, 3000, window)) return true;
  }
  return elementExists(appearSelector, window);
}

export async function clickByText(selector: string, text: string, window?: string): Promise<boolean> {
  return evaluate(
    `const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
       .find(e => e.textContent?.trim().includes(${JSON.stringify(text)}));
     if (!el) return false;
     el.click();
     return true;`,
    window,
  );
}

/**
 * Types value into an input like a user would, retrying until the value sticks; inputs inside
 * dialogs that are still animating open can drop the first keystrokes. The field is emptied
 * programmatically first because synthetic Ctrl+A does not select text in WebKitGTK.
 */
export async function fill(selector: string, value: string, window?: string, attempts = 5): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await click(selector, window);
    await evaluate(
      `const el = document.querySelector(${JSON.stringify(selector)});
       if (el) {
         el.focus();
         el.value = '';
         el.dispatchEvent(new Event('input', { bubbles: true }));
       }`,
      window,
    );
    await callTool('keyboard_type', withWindow({ text: value }, window));
    await sleep(200);
    const current: { value?: string; type?: string } = await evaluate(
      `const el = document.querySelector(${JSON.stringify(selector)});
       return { value: el?.value, type: el?.type };`,
      window,
    );
    const matches = current.type === 'number'
      ? current.value !== '' && Number(current.value) === Number(value)
      : current.value === value;
    if (matches) return;
    await sleep(300);
  }
  throw new Error(`Value did not stick in ${selector} after ${attempts} attempts`);
}

export async function domQuery(selector: string, limit = 10, window?: string): Promise<any> {
  return callTool('dom_query', withWindow({ selector, limit }, window));
}

export async function elementExists(selector: string, window?: string): Promise<boolean> {
  const result = await domQuery(selector, 1, window);
  return result.count > 0;
}

export async function elementText(selector: string, window?: string): Promise<string | undefined> {
  const result = await domQuery(selector, 1, window);
  return result.elements?.[0]?.text;
}

export async function waitForElement(selector: string, timeoutMs = 15000, window?: string): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await elementExists(selector, window)) return true;
    } catch {
      await sleep(500);
      continue;
    }
    await sleep(500);
  }
  return false;
}

export async function callBoundMethod(name: string, ...args: any[]): Promise<any> {
  return callTool('call_bound_method', { name, args });
}

export async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 2000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await predicate()) return true;
    } catch {
      await sleep(intervalMs);
      continue;
    }
    await sleep(intervalMs);
  }
  return false;
}

export async function waitForEvent(name: string, timeoutMs = 30000): Promise<any> {
  return callTool('wait_for_event', { name, timeout_ms: timeoutMs });
}

export async function emitEvent(name: string, data?: any): Promise<void> {
  await callTool('emit_event', { name, data });
}

const UPLOAD_CHUNK_SIZE = 512 * 1024;

/**
 * Places a file on a (possibly hidden) file input and fires its change event, as if the user had
 * picked it in the native file chooser. Large files are sent to the page in base64 chunks.
 */
export async function uploadFile(selector: string, filename: string, content: Buffer, mimeType: string, window?: string): Promise<void> {
  const encoded = content.toString('base64');
  await evaluate('window.__mcpUpload = [];', window);
  for (let offset = 0; offset < encoded.length; offset += UPLOAD_CHUNK_SIZE) {
    const chunk = encoded.slice(offset, offset + UPLOAD_CHUNK_SIZE);
    await evaluate(`window.__mcpUpload.push(${JSON.stringify(chunk)});`, window);
  }
  const attached = await evaluate(
    `const input = document.querySelector(${JSON.stringify(selector)});
     if (!input) return false;
     const binary = atob(window.__mcpUpload.join(''));
     delete window.__mcpUpload;
     const bytes = new Uint8Array(binary.length);
     for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
     const transfer = new DataTransfer();
     transfer.items.add(new File([bytes], ${JSON.stringify(filename)}, { type: ${JSON.stringify(mimeType)} }));
     input.files = transfer.files;
     input.dispatchEvent(new Event('change', { bubbles: true }));
     return true;`,
    window,
  );
  if (!attached) {
    throw new Error(`No file input matches ${selector}`);
  }
}
