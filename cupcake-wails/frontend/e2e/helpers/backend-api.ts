import { readFileSync } from 'fs';
import * as mcp from './mcp-client';

export interface MetadataColumn {
  id: number;
  name: string;
}

export interface MetadataTable {
  id: number;
  name: string;
  sample_count: number;
  columns: MetadataColumn[];
}

export interface AsyncTask {
  id: string;
  task_type: string;
  status: 'QUEUED' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'CANCELLED';
  metadata_table: number | null;
  error_message: string | null;
}

interface Page<T> {
  results: T[];
}

/**
 * Calls the embedded backend with the main window's session, so assertions check what was
 * actually stored rather than what the UI happens to render.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const port: number = await mcp.callBoundMethod('main.App.GetBackendPort');
  const token: string | null = await mcp.evaluate("return localStorage.getItem('ccvAccessToken');", 'main');
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`GET ${path} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getTable(tableId: number): Promise<MetadataTable> {
  return apiGet<MetadataTable>(`metadata-tables/${tableId}/`);
}

/**
 * Waits for the newest task of the given type on a table to finish and returns it.
 */
export async function waitForTask(
  tableId: number,
  taskType: string,
  timeoutMs: number,
  ignoreIds: string[] = [],
  startTimeoutMs = 60000,
): Promise<AsyncTask> {
  const findTask = async () => {
    const page = await apiGet<Page<AsyncTask>>('async-tasks/?limit=10');
    return page.results.find(t => t.metadata_table === tableId && t.task_type === taskType && !ignoreIds.includes(t.id));
  };

  if (!(await mcp.waitFor(async () => !!(await findTask()), startTimeoutMs, 2000))) {
    throw new Error(`No ${taskType} task started for table ${tableId} within ${startTimeoutMs} ms`);
  }

  let finished: AsyncTask | undefined;
  const done = await mcp.waitFor(async () => {
    const task = await findTask();
    if (task && ['SUCCESS', 'FAILURE', 'CANCELLED'].includes(task.status)) {
      finished = task;
      return true;
    }
    return false;
  }, timeoutMs, 2000);
  if (!done || !finished) {
    throw new Error(`${taskType} task for table ${tableId} did not finish within ${timeoutMs} ms`);
  }
  return finished;
}

export async function taskIds(): Promise<string[]> {
  const page = await apiGet<Page<AsyncTask>>('async-tasks/?limit=10');
  return page.results.map(t => t.id);
}

/**
 * Returns the paths the app reports saving downloads to, in the order they were saved.
 */
export async function savedDownloads(): Promise<string[]> {
  const logPath: string = await mcp.callBoundMethod('main.App.GetLogFilePath');
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .map(line => line.match(/\[App\.DownloadFile\] Saved (.+)$/)?.[1]?.trim())
    .filter((path): path is string => !!path);
}

/**
 * Waits for the app to save a download beyond the ones already counted and returns its path.
 */
export async function waitForNewDownload(previousCount: number, timeoutMs: number): Promise<string> {
  let saved: string | undefined;
  const found = await mcp.waitFor(async () => {
    const paths = await savedDownloads();
    saved = paths.length > previousCount ? paths[paths.length - 1] : undefined;
    return !!saved;
  }, timeoutMs, 1000);
  if (!found || !saved) {
    throw new Error(`No download was saved within ${timeoutMs} ms`);
  }
  return saved;
}
