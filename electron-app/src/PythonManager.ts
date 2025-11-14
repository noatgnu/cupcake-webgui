import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface PythonCandidate {
  command: string;
  version: string;
  path: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  version?: string;
}

export interface Config {
  pythonPath?: string;
  venvPath?: string;
  pythonVersion?: string;
  protocolsIoAccessToken?: string;
  enableCupcakeMacaron?: boolean;
  enableCupcakeMintChocolate?: boolean;
  enableCupcakeSaltedCaramel?: boolean;
  enableCupcakeRedVelvet?: boolean;
  [key: string]: any;
}

export class PythonManager {
  private userDataPath: string;
  private configPath: string;

  constructor() {
    this.userDataPath = app.getPath('userData');
    this.configPath = path.join(this.userDataPath, 'cupcake-config.json');
  }

  loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const config: Config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return config;
      }
    } catch (error) {
      console.warn('Failed to load config:', error);
    }
    return {};
  }

  saveConfig(config: Config): boolean {
    try {
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }
  }

  detectPythonCandidates(): Promise<PythonCandidate[]> {
    return new Promise((resolve) => {
      const pythonCandidates: string[] = [
        'python3.11', 'python3.12', 'python3.13', 'python3.14', 'python3.15',
        'python3', 'python'
      ];

      const pathEnv = process.env.PATH || '';
      const pathDirs = pathEnv.split(process.platform === 'win32' ? ';' : ':');

      const pathCandidates: string[] = [];
      for (const dir of pathDirs) {
        if (dir.trim()) {
          for (const pythonName of pythonCandidates) {
            const fullPath = path.join(dir, process.platform === 'win32' ? `${pythonName}.exe` : pythonName);
            pathCandidates.push(fullPath);
          }
        }
      }

      const allCandidates = [...pythonCandidates, ...pathCandidates];

      const validPythons: PythonCandidate[] = [];
      let candidateIndex: number = 0;

      const tryNextCandidate = (): void => {
        if (candidateIndex >= allCandidates.length) {
          resolve(validPythons);
          return;
        }

        const candidate = allCandidates[candidateIndex++];
        const versionProcess = spawn(candidate, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });

        versionProcess.stdout?.on('data', (data) => {
          const version = data.toString().trim();

          const match = version.match(/Python (\d+)\.(\d+)\.(\d+)/);
          if (match) {
            const major = parseInt(match[1]);
            const minor = parseInt(match[2]);

            if (major === 3 && minor >= 11) {
              if (!validPythons.find(p => p.path === candidate)) {
                validPythons.push({
                  command: candidate,
                  version: version,
                  path: candidate
                });
              }
            }
          }
          tryNextCandidate();
        });

        versionProcess.stderr?.on('data', () => {
          tryNextCandidate();
        });

        versionProcess.on('error', () => {
          tryNextCandidate();
        });
      };

      tryNextCandidate();
    });
  }

  verifyPython(pythonPath: string): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const versionProcess = spawn(pythonPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });

      versionProcess.stdout?.on('data', (data) => {
        const version = data.toString().trim();
        const match = version.match(/Python (\d+)\.(\d+)\.(\d+)/);
        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]);
          resolve({
            valid: major === 3 && minor >= 11,
            version: version
          });
        } else {
          resolve({ valid: false, version: 'Unknown' });
        }
      });

      versionProcess.stderr?.on('data', () => {
        resolve({ valid: false, version: 'Error' });
      });

      versionProcess.on('error', () => {
        resolve({ valid: false, version: 'Not found' });
      });
    });
  }

  checkVirtualEnvironment(): string | null {
    const config = this.loadConfig();

    // Check saved venv path first
    if (config.venvPath && fs.existsSync(config.venvPath)) {
      return config.venvPath;
    }

    // Check default location in userData
    const venvDir = path.join(this.userDataPath, 'python-env');
    const venvBin = path.join(venvDir, process.platform === 'win32' ? 'Scripts' : 'bin');
    const venvPython = path.join(venvBin, process.platform === 'win32' ? 'python.exe' : 'python');

    if (fs.existsSync(venvPython)) {
      // Save to config for future use
      config.venvPath = venvPython;
      this.saveConfig(config);
      return venvPython;
    }

    return null;
  }

  async validatePythonVersion(pythonPath: string): Promise<ValidationResult> {
    try {
      const result = await this.verifyPython(pythonPath);
      return result;
    } catch (error) {
      return {
        valid: false,
        message: `Failed to validate Python: ${error}`
      };
    }
  }

  async isConfigurationValid(): Promise<boolean> {
    const config = this.loadConfig();
    if (!config.pythonPath) {
      return false;
    }

    try {
      const pythonValid = await this.validatePythonVersion(config.pythonPath);
      if (!pythonValid.valid) {
        return false;
      }
    } catch (error) {
      return false;
    }

    const venvPath = this.checkVirtualEnvironment();
    if (!venvPath) {
      return false;
    }

    return true;
  }

  createVirtualEnvironment(pythonPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const venvDir = path.join(this.userDataPath, 'python-env');

      // Remove existing venv if it exists
      if (fs.existsSync(venvDir)) {
        fs.rmSync(venvDir, { recursive: true, force: true });
      }

      const venvProcess = spawn(pythonPath, ['-m', 'venv', venvDir], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      venvProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      venvProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      venvProcess.on('close', (code) => {
        if (code === 0) {
          const venvBin = path.join(venvDir, process.platform === 'win32' ? 'Scripts' : 'bin');
          const venvPython = path.join(venvBin, process.platform === 'win32' ? 'python.exe' : 'python');

          // Save to config
          const config = this.loadConfig();
          config.venvPath = venvPython;
          this.saveConfig(config);

          resolve(venvPython);
        } else {
          reject(new Error(`Virtual environment creation failed: ${errorOutput}`));
        }
      });

      venvProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  installDependencies(venvPython: string, requirementsPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const installProcess = spawn(venvPython, ['-m', 'pip', 'install', '-r', requirementsPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      installProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      installProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Dependency installation failed: ${errorOutput}`));
        }
      });

      installProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
}