import * as mcp from './mcp-client';
import { apiGet } from './backend-api';

const MAIN = 'main';

export type ImportKind = 'sdrf' | 'excel';

export const TEMPLATES_ROUTE = '#/metadata-table-templates';

const IMPORT_INPUTS: Record<ImportKind, { selector: string; mimeType: string }> = {
  sdrf: { selector: 'input[type="file"][accept=".txt,.tsv"]', mimeType: 'text/tab-separated-values' },
  excel: {
    selector: 'input[type="file"][accept=".xlsx,.xls"]',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

export function expectTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

/**
 * Navigates the main window to a hash route, clicking the app's own link to it when one is
 * shown; assigning location.hash alone does not re-render child routes of the current parent.
 */
export async function goTo(hash: string): Promise<void> {
  await mcp.evaluate(
    `const link = document.querySelector(${JSON.stringify(`a[href="${hash}"]`)});
     if (link) link.click();
     else window.location.hash = ${JSON.stringify(hash)};`,
    MAIN,
  );
}

async function clickRowAction(rowText: string, actionTitle: string): Promise<boolean> {
  return mcp.evaluate(
    `const row = [...document.querySelectorAll('tr')].find(r => r.textContent.includes(${JSON.stringify(rowText)}));
     const action = row?.querySelector(${JSON.stringify(`[title="${actionTitle}"]`)});
     if (!action) return false;
     action.click();
     return true;`,
    MAIN,
  );
}

async function currentTableId(): Promise<number | undefined> {
  const url = await mcp.getUrl(MAIN);
  const match = url.match(/#\/metadata-tables\/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Creates an empty metadata table from the tables list, opens it and returns its id.
 */
export async function createTable(name: string): Promise<number> {
  await goTo('#/metadata-tables');
  expectTrue(await mcp.waitForElement('[title="New Table"]', 30000, MAIN), 'New Table button not found');
  expectTrue(await mcp.clickUntilPresent('[title="New Table"]', '#tableName', MAIN), 'New Table dialog did not open');
  await mcp.fill('#tableName', name, MAIN);
  expectTrue(await mcp.clickUntilGone('.modal-footer .btn-primary', '#tableName', MAIN), 'New Table dialog did not close');

  expectTrue(
    await mcp.waitFor(() => clickRowAction(name, 'View table'), 30000, 1000),
    `Table "${name}" did not appear in the list`,
  );

  let tableId: number | undefined;
  expectTrue(
    await mcp.waitFor(async () => !!(tableId = await currentTableId()), 30000, 500),
    `Table "${name}" did not open`,
  );
  return tableId!;
}

export async function openTable(tableId: number): Promise<void> {
  await goTo(`#/metadata-tables/${tableId}`);
  expectTrue(await mcp.waitForElement('[title="Import Data"]', 30000, MAIN), `Table ${tableId} did not load`);
}

async function confirmDialog(): Promise<void> {
  expectTrue(await mcp.waitForElement('ngb-modal-window .btn-danger', 15000, MAIN), 'Confirmation dialog did not appear');
  expectTrue(
    await mcp.clickUntilGone('ngb-modal-window .btn-danger', 'ngb-modal-window .btn-danger', MAIN),
    'Confirmation dialog did not close',
  );
}

/**
 * Imports a file into the open table through the Import menu. The file is handed to the hidden
 * input directly, because the menu entry would open the native file chooser.
 */
export async function importFile(kind: ImportKind, filename: string, content: Buffer, overrideSampleCount: boolean): Promise<void> {
  expectTrue(await mcp.clickUntilPresent('[title="Import Data"]', '#overrideSampleCountToggle', MAIN), 'Import menu did not open');
  await mcp.evaluate(
    `const toggle = document.querySelector('#overrideSampleCountToggle');
     if (toggle.checked !== ${overrideSampleCount}) toggle.click();`,
    MAIN,
  );

  const input = IMPORT_INPUTS[kind];
  await mcp.uploadFile(input.selector, filename, content, input.mimeType, MAIN);
  await confirmDialog();
}

/**
 * Starts an export of the open table; Excel exports go through the options dialog with its defaults.
 */
export async function exportTable(kind: ImportKind): Promise<void> {
  expectTrue(await mcp.waitForElement('[title="Export Table"]', 30000, MAIN), 'Export menu is not available');
  const exportMenu = '[title="Export Table"] + .dropdown-menu.show';
  expectTrue(await mcp.clickUntilPresent('[title="Export Table"]', exportMenu, MAIN), 'Export menu did not open');
  const label = kind === 'sdrf' ? 'Export as SDRF' : 'Export as Excel';
  expectTrue(
    await mcp.waitFor(() => mcp.clickByText(`${exportMenu} .dropdown-item`, label, MAIN), 10000, 500),
    `"${label}" menu entry not found`,
  );
  if (kind === 'excel') {
    expectTrue(await mcp.waitForElement('ngb-modal-window .modal-footer .btn-primary', 15000, MAIN), 'Excel export dialog did not open');
    expectTrue(
      await mcp.clickUntilGone('ngb-modal-window .modal-footer .btn-primary', 'ngb-modal-window', MAIN),
      'Excel export dialog did not close',
    );
  }
}

/**
 * Creates a metadata table template from the first standalone schema offered, optionally
 * assigning it to a lab group so jobs for that group can use it. Returns once the template is
 * listed, which happens only after the backend has finished creating it; the dialog closes earlier.
 */
export async function createTemplateFromSchemas(name: string, templatesRoute = TEMPLATES_ROUTE, labGroupName?: string): Promise<void> {
  await goTo(templatesRoute);

  let schemasShown = false;
  for (let attempt = 0; attempt < 5 && !schemasShown; attempt++) {
    expectTrue(
      await mcp.waitFor(async () => {
        if (await mcp.elementExists('.dropdown-menu.show', MAIN)) return true;
        await mcp.clickByText('button.dropdown-toggle', 'New Template', MAIN);
        return mcp.waitForElement('.dropdown-menu.show', 2000, MAIN);
      }, 30000, 500),
      'New Template menu did not open',
    );
    expectTrue(
      await mcp.waitFor(() => mcp.clickByText('.dropdown-menu.show .dropdown-item', 'Create from Schemas', MAIN), 10000, 500),
      'Create from Schemas entry not found',
    );
    expectTrue(await mcp.waitForElement('ngb-modal-window #templateName', 15000, MAIN), 'Schema selection dialog did not open');
    schemasShown = await mcp.waitForElement('ngb-modal-window .schema-card', 5000, MAIN);
    if (!schemasShown) {
      await dismissDialogs();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  expectTrue(schemasShown, 'The schema selection dialog never listed any schemas');

  await mcp.fill('ngb-modal-window #templateName', name, MAIN);
  expectTrue(
    await mcp.waitFor(() => mcp.evaluate(
      `const card = [...document.querySelectorAll('ngb-modal-window .schema-card')].find(c => c.textContent.includes('Standalone'));
       if (!card) return false;
       if (!card.classList.contains('selected')) card.click();
       return true;`,
      MAIN,
    ), 30000, 1000),
    'No standalone schema to select',
  );
  if (labGroupName) {
    expectTrue(
      await mcp.waitFor(() => mcp.evaluate(
        `const select = document.querySelector('ngb-modal-window #labGroup');
         const option = select && [...select.options].find(o => o.textContent.includes(${JSON.stringify(labGroupName)}));
         if (!option) return false;
         select.value = option.value;
         select.dispatchEvent(new Event('change', { bubbles: true }));
         return true;`,
        MAIN,
      ), 30000, 1000),
      `Lab group "${labGroupName}" is not offered for the template`,
    );
  }
  expectTrue(
    await mcp.clickUntilGone('ngb-modal-window .modal-footer .btn-primary', 'ngb-modal-window #templateName', MAIN),
    'Schema selection dialog did not close',
  );
  await mcp.fill('#templateSearch', name, MAIN);
  expectTrue(
    await mcp.waitFor(() => mcp.evaluate(
      `return [...document.querySelectorAll('tr')].some(r => r.textContent.includes(${JSON.stringify(name)}));`,
      MAIN,
    ), 60000, 1000),
    `Template "${name}" was not listed after creation`,
  );
}

/**
 * Creates a metadata table from a template through its row action.
 */
export async function createTableFromTemplate(
  templateName: string,
  tableName: string,
  sampleCount: number,
  templatesRoute = TEMPLATES_ROUTE,
): Promise<void> {
  await goTo(templatesRoute);
  await mcp.waitForElement('#templateSearch', 30000, MAIN);
  await mcp.fill('#templateSearch', templateName, MAIN);
  expectTrue(
    await mcp.waitFor(() => clickRowAction(templateName, 'Create metadata table from this template'), 30000, 1000),
    `Template "${templateName}" is not listed`,
  );
  expectTrue(await mcp.waitForElement('ngb-modal-window #tableName', 15000, MAIN), 'Table creation dialog did not open');
  await mcp.fill('ngb-modal-window #tableName', tableName, MAIN);
  await mcp.fill('ngb-modal-window #sampleCount', String(sampleCount), MAIN);
  expectTrue(
    await mcp.clickUntilGone('ngb-modal-window .modal-footer .btn-success', 'ngb-modal-window #tableName', MAIN),
    'Table creation dialog did not close',
  );
}

/**
 * Runs a Management panel command and waits until the panel reports it finished, failing with
 * the panel's own error output when the command does not succeed.
 */
async function runManagementCommand(displayName: string, timeoutMs: number): Promise<void> {
  const MANAGEMENT = 'management';
  if (!(await mcp.waitForWindow(MANAGEMENT, 1000))) {
    await mcp.callBoundMethod('main.App.OpenManagementPanel');
    expectTrue(await mcp.waitForWindow(MANAGEMENT, 30000), 'Management window did not open');
  }

  const row = `[...document.querySelectorAll('.command-row')]
    .find(r => r.querySelector('.cmd-name')?.textContent.includes(${JSON.stringify(displayName)}))`;
  await mcp.evaluate('document.querySelector(".btn-clear")?.click();', MANAGEMENT);
  expectTrue(
    await mcp.waitFor(() => mcp.evaluate(
      `const run = ${row}?.querySelector('.btn-exec');
       if (!run || run.disabled) return false;
       run.click();
       return true;`,
      MANAGEMENT,
    ), 30000, 1000),
    `"${displayName}" command not found in the Management panel`,
  );

  let outcome = '';
  const finished = await mcp.waitFor(async () => {
    outcome = await mcp.evaluate(
      `const lines = [...document.querySelectorAll('.term-line')].map(l => l.textContent.trim());
       return lines.find(l => /Process (completed successfully|failed)/.test(l)) ?? '';`,
      MANAGEMENT,
    );
    return outcome !== '';
  }, timeoutMs, 2000);
  expectTrue(finished, `"${displayName}" did not finish within ${timeoutMs} ms`);
  expectTrue(outcome.includes('completed successfully'), `"${displayName}" failed: ${outcome}`);
}

/**
 * Loads the official SDRF schemas and the column templates they are built from through the
 * Management panel, which a fresh desktop install needs before templates can be created from
 * schemas. The panel is opened through the same bound method as its application-menu entry,
 * since native menus are not reachable from automation. Commands whose data is already present
 * are skipped.
 */
export async function prepareMetadataFromManagement(timeoutMs = 10 * 60 * 1000): Promise<{ schemas: number; columnTemplates: number }> {
  const count = async (path: string) => (await apiGet<{ count: number }>(`${path}?limit=1`)).count;

  if ((await count('schemas/')) === 0) {
    await runManagementCommand('SDRF Schema Synchronization', timeoutMs);
  }
  if ((await count('column-templates/')) === 0) {
    await runManagementCommand('Column Template Provisioning', timeoutMs);
  }
  return { schemas: await count('schemas/'), columnTemplates: await count('column-templates/') };
}

/**
 * Closes any dialogs left open in the main window, newest first, so one test's leftovers cannot
 * intercept the next test's clicks.
 */
export async function dismissDialogs(): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const remaining: number = await mcp.evaluate(
      `const dialogs = [...document.querySelectorAll('ngb-modal-window')];
       const last = dialogs[dialogs.length - 1];
       if (!last) return 0;
       const close = last.querySelector('.btn-close')
         ?? [...last.querySelectorAll('button')].find(b => /cancel|close/i.test(b.textContent));
       close?.click();
       return dialogs.length;`,
      MAIN,
    );
    if (remaining === 0) return;
    await mcp.waitFor(async () => (await mcp.evaluate("return document.querySelectorAll('ngb-modal-window').length;", MAIN)) < remaining, 3000, 300);
  }
  expectTrue(!(await mcp.elementExists('ngb-modal-window', MAIN)), 'Dialogs could not be closed');
}
