import { ChildProcess, execFileSync, execSync, spawn } from 'child_process';
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface IsolatedApp {
  configHome: string;
  dataDir: string;
  display: number;
  stop: () => void;
}

/** The name of the app's data folder inside XDG_CONFIG_HOME, from the app binary's name. */
export function dataFolderName(binary: string): string {
  return binary.includes('vanilla') ? 'cupcake-vanilla' : 'cupcake';
}

/**
 * Prepare a scratch data folder in which the app finds an installed native backend: a copy of the backend
 * source without requirements.txt, so nothing is installed, run by an existing Python environment.
 */
export function provisionBackend(configHome: string, binary: string, backendSource: string, python: string): string {
  const dataDir = join(configHome, dataFolderName(binary));
  const backendDir = join(dataDir, 'backend');
  rmSync(configHome, { recursive: true, force: true });
  mkdirSync(backendDir, { recursive: true });
  execSync(
    `git -C "${backendSource}" ls-files -z -c -o --exclude-standard | grep -zvE '\\.(sdrf|tsv|xlsx|psql|sqlite3|gz|bin)$|^media/|^packages/|^sdk/' | tar -C "${backendSource}" --null -T - -cf - | tar -C "${backendDir}" -xf -`,
    { stdio: 'inherit', shell: '/bin/bash' },
  );
  rmSync(join(backendDir, 'requirements.txt'), { force: true });
  writeFileSync(
    join(dataDir, 'python-config.json'),
    JSON.stringify({ pythonPath: python, venvPath: python, distributionType: 'native', backendSource: 'git' }, null, 2),
  );
  return dataDir;
}

/** Start the app in its own process namespace on a virtual screen; stop() ends it and everything it started. */
export function launchIsolated(binary: string, configHome: string, display: number, decoyTag = ''): IsolatedApp {
  const script = join(__dirname, '..', 'ui', 'launch-isolated.sh');
  chmodSync(script, 0o755);
  const child: ChildProcess = spawn(script, [], {
    env: { ...process.env, WAILS_APP_BINARY: binary, APP_CONFIG_HOME: configHome, APP_DISPLAY: String(display), DECOY_TAG: decoyTag },
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: true,
  });
  const stop = () => {
    const unsharePid = child.pid;
    if (!unsharePid) {
      return;
    }
    try {
      const init = execFileSync('pgrep', ['-P', String(unsharePid)]).toString().trim().split('\n')[0];
      if (init) {
        process.kill(Number(init), 'SIGKILL');
      }
    } catch {
      return;
    }
    for (let attempt = 0; attempt < 50 && existsSync(`/proc/${unsharePid}`); attempt++) {
      execSync('sleep 0.1');
    }
  };
  return { configHome, dataDir: join(configHome, dataFolderName(binary)), display, stop };
}

/** Whether a process whose command line contains text is running on this computer. */
export function processRunning(text: string): boolean {
  try {
    execFileSync('pgrep', ['-f', text]);
    return true;
  } catch {
    return false;
  }
}

/** The local addresses on which TCP ports are listening on this computer. */
export function listeningAddresses(): Set<string> {
  const output = execFileSync('ss', ['-Hltn']).toString();
  return new Set(output.split('\n').filter(Boolean).map(line => line.trim().split(/\s+/)[3]));
}
