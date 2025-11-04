import { DownloaderManager, DownloadTask } from './DownloaderManager';
import { BackendDownloader, BackendDownloadOptions } from './BackendDownloader';
import { ValkeyDownloader } from './ValkeyDownloader';

/**
 * Helper functions for common download tasks
 */

/**
 * Download portable backend
 */
export async function downloadPortableBackend(
  downloaderManager: DownloaderManager,
  version: string,
  pythonVersion: string,
  destPath: string
): Promise<void> {
  const task: DownloadTask = {
    title: 'Downloading Backend',
    description: `Downloading Cupcake Vanilla Backend ${version}`,
    execute: async (window) => {
      const downloader = new BackendDownloader(window);
      await downloader.downloadPortable({
        version,
        isPortable: true,
        pythonVersion,
        destPath
      });
    }
  };

  await downloaderManager.startDownload(task);
}

/**
 * Download backend source
 */
export async function downloadBackendSource(
  downloaderManager: DownloaderManager,
  destPath: string
): Promise<void> {
  const task: DownloadTask = {
    title: 'Cloning Backend',
    description: 'Cloning Cupcake Vanilla Backend from GitHub',
    execute: async (window) => {
      const downloader = new BackendDownloader(window);
      await downloader.downloadSource(destPath);
    }
  };

  await downloaderManager.startDownload(task);
}

/**
 * Download Valkey
 */
export async function downloadValkey(
  downloaderManager: DownloaderManager,
  destPath: string
): Promise<void> {
  const task: DownloadTask = {
    title: 'Downloading Valkey',
    description: 'Downloading Valkey binaries from GitHub',
    execute: async (window) => {
      const downloader = new ValkeyDownloader(window);
      await downloader.downloadValkey(destPath);
    }
  };

  await downloaderManager.startDownload(task);
}

/**
 * Get latest backend release version
 */
export async function getLatestBackendVersion(): Promise<string | null> {
  const downloader = new BackendDownloader();
  try {
    const releases = await downloader.getAvailableReleases();
    if (releases.length > 0) {
      return releases[0].tag;
    }
  } catch (error) {
    console.error('Failed to fetch backend releases:', error);
  }
  return null;
}