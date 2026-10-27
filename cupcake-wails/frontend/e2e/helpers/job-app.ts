import * as mcp from './mcp-client';
import { expectTrue, goTo, ImportKind } from './main-app';

const MAIN = 'main';
const EDITOR = 'app-metadata-table-editor';

export const JOB_TEMPLATES_ROUTE = '#/jobs/templates';

const EDITOR_INPUTS: Record<ImportKind, { selector: string; mimeType: string }> = {
  sdrf: { selector: `${EDITOR} input[type="file"][accept=".txt,.tsv"]`, mimeType: 'text/tab-separated-values' },
  excel: {
    selector: `${EDITOR} input[type="file"][accept=".xlsx,.xls"]`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
};

async function clickButtonWithText(text: string, scope = ''): Promise<boolean> {
  return mcp.waitFor(() => mcp.evaluate(
    `const button = [...document.querySelectorAll(${JSON.stringify(`${scope} button`.trim())})]
       .find(b => b.textContent.trim().includes(${JSON.stringify(text)}) && !b.disabled);
     if (!button) return false;
     button.click();
     return true;`,
    MAIN,
  ), 15000, 500);
}

/**
 * Opens a page of the Jobs section through its navbar, which only exists once Jobs is shown.
 */
export async function openJobsSection(href: string): Promise<void> {
  await goTo('#/jobs');
  expectTrue(
    await mcp.waitFor(async () => (await mcp.getUrl(MAIN)).endsWith('#/jobs'), 30000, 500),
    'Jobs page did not open',
  );
  expectTrue(await mcp.waitForElement(`a[href="${href}"]`, 30000, MAIN), `Jobs navbar link ${href} not found`);
  await goTo(href);
  expectTrue(
    await mcp.waitFor(async () => (await mcp.getUrl(MAIN)).endsWith(href), 30000, 500),
    `${href} did not open`,
  );
}

/**
 * Creates a top-level lab group from the Lab Groups section of the Home page.
 */
export async function createLabGroup(name: string): Promise<void> {
  await goTo('#/home');
  expectTrue(
    await mcp.waitFor(async () => {
      if (await mcp.elementExists('app-lab-group-list', MAIN)) return true;
      await mcp.evaluate(
        `[...document.querySelectorAll('a, button')].find(e => e.textContent.trim() === 'Lab Groups')?.click();`,
        MAIN,
      );
      return false;
    }, 30000, 1000),
    'Lab Groups page did not open',
  );
  expectTrue(await clickButtonWithText('Create Lab Group', 'app-lab-group-list'), 'Create Lab Group button not available');
  expectTrue(await mcp.waitForElement('ngb-modal-window #name', 15000, MAIN), 'Create lab group dialog did not open');
  await mcp.fill('ngb-modal-window #name', name, MAIN);
  expectTrue(
    await mcp.clickUntilGone('ngb-modal-window .modal-footer .btn-primary', 'ngb-modal-window #name', MAIN),
    'Create lab group dialog did not close',
  );
}

/**
 * Walks the job submission wizard up to the metadata step and creates the job's metadata table
 * from the given template, leaving the embedded metadata editor open.
 */
export async function startJobWithMetadataTable(
  jobTitle: string,
  projectTitle: string,
  labGroupName: string,
  templateName: string,
  sampleCount: number,
): Promise<void> {
  await openJobsSection('#/jobs/submit');
  expectTrue(await mcp.waitForElement('#jobTitle', 30000, MAIN), 'Job submission wizard did not load');
  await mcp.fill('#jobTitle', jobTitle, MAIN);
  await mcp.fill('#projectTitle', projectTitle, MAIN);
  expectTrue(await clickButtonWithText('Create Draft Job'), 'Create Draft Job button not available');
  expectTrue(await mcp.waitForElement('#labGroup', 30000, MAIN), 'Lab group step did not open');

  await mcp.fill('#labGroup', labGroupName, MAIN);
  const suggestion = '#labGroup ~ .list-group .list-group-item-action';
  expectTrue(
    await mcp.waitFor(async () => (await mcp.elementText(suggestion, MAIN))?.includes(labGroupName) ?? false, 30000, 1000),
    `Lab group "${labGroupName}" was not suggested`,
  );
  await mcp.click(suggestion, MAIN);
  expectTrue(await clickButtonWithText('Save & Continue'), 'Lab group step could not continue');

  expectTrue(await mcp.waitForElement('#sampleNumber', 30000, MAIN), 'Samples step did not open');
  await mcp.fill('#sampleNumber', String(sampleCount), MAIN);
  expectTrue(await clickButtonWithText('Save & Continue'), 'Samples step could not continue');

  expectTrue(await mcp.waitForElement('#template', 30000, MAIN), 'Template step did not open');
  expectTrue(
    await mcp.waitFor(() => mcp.evaluate(
      `const select = document.querySelector('#template');
       const option = [...select.options].find(o => o.textContent.includes(${JSON.stringify(templateName)}));
       if (!option) return false;
       select.value = option.value;
       select.dispatchEvent(new Event('change', { bubbles: true }));
       return true;`,
      MAIN,
    ), 30000, 1000),
    `Template "${templateName}" is not offered`,
  );
  expectTrue(await clickButtonWithText('Save & Continue'), 'Template step could not continue');

  expectTrue(await clickButtonWithText('Create Metadata Table'), 'Create Metadata Table button not available');
  expectTrue(await mcp.waitForElement(`${EDITOR} [title="Import"]`, 60000, MAIN), 'Metadata editor did not appear');
}

/**
 * Imports a file through the embedded metadata editor. The editor asks with the native
 * confirm() dialog, which cannot be clicked from automation, so it is answered with "OK".
 */
export async function editorImport(kind: ImportKind, filename: string, content: Buffer): Promise<void> {
  await mcp.evaluate('window.confirm = () => true;', MAIN);
  const input = EDITOR_INPUTS[kind];
  await mcp.uploadFile(input.selector, filename, content, input.mimeType, MAIN);
}

/**
 * Starts an export from the embedded metadata editor; Excel exports accept the options dialog defaults.
 */
export async function editorExport(kind: ImportKind): Promise<void> {
  const menu = `${EDITOR} [title="Export"] + .dropdown-menu.show`;
  expectTrue(await mcp.waitForElement(`${EDITOR} [title="Export"]`, 60000, MAIN), 'Export menu is not available');
  expectTrue(await mcp.clickUntilPresent(`${EDITOR} [title="Export"]`, menu, MAIN), 'Export menu did not open');
  const label = kind === 'sdrf' ? 'Export as SDRF' : 'Export as Excel';
  expectTrue(
    await mcp.waitFor(() => mcp.clickByText(`${menu} .dropdown-item`, label, MAIN), 10000, 500),
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

export async function submitJob(): Promise<void> {
  expectTrue(await clickButtonWithText('Submit Job'), 'Submit Job button not available');
}
