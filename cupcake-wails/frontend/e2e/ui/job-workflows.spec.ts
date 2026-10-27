import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { basename, join } from 'path';
import { ensureLoggedIn } from '../helpers/admin';
import { apiGet, getTable, MetadataTable, savedDownloads, taskIds, waitForNewDownload, waitForTask } from '../helpers/backend-api';
import { createTemplateFromSchemas, dismissDialogs, prepareMetadataFromManagement } from '../helpers/main-app';
import { createLabGroup, editorExport, editorImport, JOB_TEMPLATES_ROUTE, openJobsSection, startJobWithMetadataTable, submitJob } from '../helpers/job-app';
import * as mcp from '../helpers/mcp-client';

const FIXTURES_DIR = process.env['E2E_FIXTURES_DIR'] || join(__dirname, '..', '..', '..', '..', 'e2e', 'fixtures', 'sdrf');
const FIXTURE = 'PXD019185_PXD018883.sdrf.tsv';
const TASK_TIMEOUT = 10 * 60 * 1000;

interface Sdrf {
  headers: string[];
  rows: string[][];
}

interface Job {
  id: number;
  job_name: string;
  status: string;
  sample_number: number;
  metadata_table: number | null;
}

interface Named {
  id: number;
  name: string;
}

function parseSdrf(content: string): Sdrf {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  const [header, ...rows] = lines.map(line => line.split('\t'));
  return { headers: header.map(h => h.trim().toLowerCase()), rows };
}

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const fixtureContent = readFileSync(join(FIXTURES_DIR, FIXTURE));
const fixtureSdrf = parseSdrf(fixtureContent.toString('utf8'));

const run = {
  labGroup: `UI lab ${unique()}`,
  template: `UI job template ${unique()}`,
  job: `UI job ${unique()}`,
};

async function findJob(): Promise<Job> {
  const jobs = await apiGet<{ results: Job[] }>(`instrument-jobs/?search=${encodeURIComponent(run.job)}&limit=10`);
  const job = jobs.results.find(j => j.job_name === run.job);
  if (!job) throw new Error(`Job "${run.job}" not found`);
  return job;
}

async function jobTable(): Promise<MetadataTable> {
  const job = await findJob();
  expect(job.metadata_table, 'job should own a metadata table').toBeTruthy();
  return getTable(job.metadata_table!);
}

test.describe.configure({ mode: 'serial' });

test.describe('Instrument job metadata workflows in the desktop app', () => {
  test.beforeAll(async () => {
    await ensureLoggedIn();
  });

  test.beforeEach(async () => {
    await dismissDialogs();
  });

  test('creates a lab group', async () => {
    await createLabGroup(run.labGroup);
    const groups = await apiGet<{ results: Named[] }>(`lab-groups/?search=${encodeURIComponent(run.labGroup)}&limit=10`);
    expect(groups.results.map(g => g.name)).toContain(run.labGroup);
  });

  test('loads SDRF schemas and column templates from the Management panel', async () => {
    test.setTimeout(21 * 60 * 1000);
    const loaded = await prepareMetadataFromManagement();
    expect(loaded.schemas).toBeGreaterThan(0);
    expect(loaded.columnTemplates).toBeGreaterThan(0);
  });

  test('creates a table template from a schema on the jobs templates page', async () => {
    await openJobsSection(JOB_TEMPLATES_ROUTE);
    await createTemplateFromSchemas(run.template, JOB_TEMPLATES_ROUTE, run.labGroup);
    const templates = await apiGet<{ results: (Named & { column_count: number })[] }>(
      `metadata-table-templates/?search=${encodeURIComponent(run.template)}&limit=10`,
    );
    const template = templates.results.find(t => t.name === run.template);
    expect(template, 'template should be saved').toBeTruthy();
    expect(template!.column_count).toBeGreaterThan(0);
  });

  test('job wizard creates the job metadata table from the template', async () => {
    test.setTimeout(240000);
    await startJobWithMetadataTable(run.job, `UI project ${unique()}`, run.labGroup, run.template, fixtureSdrf.rows.length);

    const job = await findJob();
    expect(job.sample_number).toBe(fixtureSdrf.rows.length);
    const table = await jobTable();
    expect(table.sample_count).toBe(fixtureSdrf.rows.length);
    expect(table.columns.length).toBeGreaterThan(0);
  });

  test('imports an SDRF file into the job metadata table', async () => {
    test.setTimeout(TASK_TIMEOUT + 120000);
    const before = await jobTable();
    const tasksBefore = await taskIds();

    await editorImport('sdrf', FIXTURE, fixtureContent);
    const task = await waitForTask(before.id, 'IMPORT_SDRF', TASK_TIMEOUT, tasksBefore);
    expect(task.status, task.error_message ?? '').toBe('SUCCESS');

    const table = await getTable(before.id);
    expect(table.sample_count).toBe(fixtureSdrf.rows.length);
    const names = new Set(table.columns.map(c => c.name.toLowerCase()));
    for (const header of fixtureSdrf.headers) {
      expect(names.has(header), `column ${header}`).toBe(true);
    }
  });

  test('exports the job metadata as SDRF with every imported sample', async () => {
    test.setTimeout(TASK_TIMEOUT + 120000);
    const table = await jobTable();
    const downloadsBefore = (await savedDownloads()).length;
    const tasksBefore = await taskIds();

    await editorExport('sdrf');
    const task = await waitForTask(table.id, 'EXPORT_SDRF', TASK_TIMEOUT, tasksBefore);
    expect(task.status, task.error_message ?? '').toBe('SUCCESS');

    const saved = await waitForNewDownload(downloadsBefore, 60000);
    const exported = parseSdrf(readFileSync(saved, 'utf8'));
    expect(exported.rows.length).toBe(fixtureSdrf.rows.length);
    for (const header of fixtureSdrf.headers) {
      expect(exported.headers, `exported column ${header}`).toContain(header);
    }
    const source = fixtureSdrf.headers.indexOf('source name');
    const exportedSource = exported.headers.indexOf('source name');
    expect(exported.rows.map(r => r[exportedSource])).toEqual(fixtureSdrf.rows.map(r => r[source]));
  });

  test('exports the job metadata as Excel and imports the workbook back unchanged', async () => {
    test.setTimeout(2 * TASK_TIMEOUT + 120000);
    const table = await jobTable();
    const downloadsBefore = (await savedDownloads()).length;
    const exportTasksBefore = await taskIds();

    await editorExport('excel');
    const exportTask = await waitForTask(table.id, 'EXPORT_EXCEL', TASK_TIMEOUT, exportTasksBefore);
    expect(exportTask.status, exportTask.error_message ?? '').toBe('SUCCESS');

    const saved = await waitForNewDownload(downloadsBefore, 60000);
    expect(basename(saved)).toMatch(/\.xlsx$/i);
    const workbook = readFileSync(saved);
    expect(workbook.subarray(0, 2).toString('latin1')).toBe('PK');

    const importTasksBefore = await taskIds();
    await editorImport('excel', basename(saved), workbook);
    const importTask = await waitForTask(table.id, 'IMPORT_EXCEL', TASK_TIMEOUT, importTasksBefore);
    expect(importTask.status, importTask.error_message ?? '').toBe('SUCCESS');

    const reimported = await getTable(table.id);
    expect(reimported.sample_count).toBe(table.sample_count);
    expect(reimported.columns.map(c => c.name).sort()).toEqual(table.columns.map(c => c.name).sort());
  });

  test('submits the job', async () => {
    await submitJob();
    const submitted = await mcp.waitFor(async () => (await findJob()).status === 'submitted', 60000, 2000);
    expect(submitted, 'job should be submitted').toBe(true);
  });
});
