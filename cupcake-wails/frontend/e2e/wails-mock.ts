import { Page } from '@playwright/test';

const MOCK_NAMESPACE = '__playwrightWailsMock__';

export async function setupWailsMock(page: Page): Promise<void> {
  await page.addInitScript(`
    window['${MOCK_NAMESPACE}'] = {
      eventListeners: new Map(),
      enabled: true,

      registerListener: function(eventName, callback) {
        const listeners = this.eventListeners.get(eventName) || [];
        listeners.push(callback);
        this.eventListeners.set(eventName, listeners);
        console.log('[MockWails] Registered listener for:', eventName, 'total:', listeners.length);
        return () => {
          const ls = this.eventListeners.get(eventName) || [];
          const idx = ls.indexOf(callback);
          if (idx > -1) ls.splice(idx, 1);
        };
      },

      dispatchEvent: function(eventName, data) {
        console.log('[MockWails] dispatchEvent:', eventName);
        const listeners = this.eventListeners.get(eventName) || [];
        console.log('[MockWails] Found', listeners.length, 'listeners');
        listeners.forEach((listener, idx) => {
          try {
            console.log('[MockWails] Calling listener', idx);
            listener({ name: eventName, data: data });
            console.log('[MockWails] Listener', idx, 'complete');
          } catch (e) {
            console.error('[MockWails] Listener error:', e);
          }
        });
      },

      getListenerCount: function(eventName) {
        return (this.eventListeners.get(eventName) || []).length;
      },

      clear: function() {
        this.eventListeners.clear();
      }
    };

    console.log('[MockWails] Mock namespace initialized');
  `);
}

export async function emitMockEvent(page: Page, eventName: string, data: unknown): Promise<void> {
  await page.evaluate(({ ns, eventName, data }) => {
    const mock = (window as any)[ns];
    if (mock?.dispatchEvent) {
      mock.dispatchEvent(eventName, data);
    } else {
      console.error('[E2E] Mock not found');
    }
  }, { ns: MOCK_NAMESPACE, eventName, data });
}

export async function waitForEventListeners(page: Page, timeout = 3000): Promise<void> {
  await page.waitForFunction((ns) => {
    return (window as any)[ns]?.enabled === true;
  }, MOCK_NAMESPACE, { timeout });

  await page.waitForTimeout(500);
}

export async function getRegisteredListeners(page: Page): Promise<Record<string, number>> {
  return await page.evaluate((ns) => {
    const mock = (window as any)[ns];
    const events = ['backend:status', 'backend:log', 'download:progress', 'download:complete'];
    const counts: Record<string, number> = {};
    for (const event of events) {
      counts[event] = mock?.getListenerCount?.(event) ?? -1;
    }
    return counts;
  }, MOCK_NAMESPACE);
}

export async function clearMockListeners(page: Page): Promise<void> {
  await page.evaluate((ns) => {
    const mock = (window as any)[ns];
    mock?.clear?.();
  }, MOCK_NAMESPACE);
}

export const PLAYWRIGHT_MOCK_NAMESPACE = MOCK_NAMESPACE;
