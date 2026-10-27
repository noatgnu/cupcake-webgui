import * as mcp from './mcp-client';

export const ADMIN = {
  username: 'uitestadmin',
  email: 'uitest@cupcake.test',
  password: 'UiTestAdmin123!',
};

/**
 * Makes sure the main window holds an authenticated session for the UI-test admin,
 * logging in through the login form when it does not.
 */
export async function ensureLoggedIn(): Promise<void> {
  const hasToken = async () => mcp.evaluate("return !!localStorage.getItem('ccvAccessToken');", 'main');
  if (await hasToken()) return;

  await mcp.evaluate("window.location.hash = '#/login';", 'main');
  if (!(await mcp.waitForElement('#username', 60000, 'main'))) {
    throw new Error('Login form did not appear in the main window');
  }
  await mcp.fill('#username', ADMIN.username, 'main');
  await mcp.fill('#password', ADMIN.password, 'main');
  await mcp.click('button[type="submit"]', 'main');
  if (!(await mcp.waitFor(hasToken, 60000, 1000))) {
    throw new Error('Login did not produce an access token');
  }
}
