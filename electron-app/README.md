# Cupcake Electron Application

This directory contains the Electron desktop application wrapper for Cupcake.

## Features

- **Backend Management**: Automatically downloads and manages the Django backend
- **Python Environment**: Manages Python installation and virtual environments
- **Redis/Valkey**: Handles Redis/Valkey setup for caching
- **Database**: Manages SQLite database for local data storage
- **Auto-Updates**: Built-in update mechanism for the application
- **Cross-Platform**: Supports Windows, macOS, and Linux

## Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Install Dependencies

```bash
cd electron-app
npm install
```

### Development Mode (with dev server)

This mode runs the Angular dev server and opens Electron pointing to it:

```bash
# From the root cupcake directory
npm run electron:dev:server
```

### Development Mode (with built files)

This mode builds the Angular app and runs Electron with the built files:

```bash
# From the root cupcake directory
npm run electron:dev:built
```

## Building

### Build for All Platforms

```bash
# From the root cupcake directory
npm run electron:build
```

### Platform-Specific Builds

```bash
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

The built applications will be in `electron-app/dist/`.

## Project Structure

```
electron-app/
├── src/                          # TypeScript source files
│   ├── main.ts                  # Main Electron process
│   ├── BackendManager.ts        # Django backend management
│   ├── PythonManager.ts         # Python environment management
│   ├── RedisManager.ts          # Redis/Valkey management
│   ├── UserManager.ts           # User authentication
│   ├── BackendDownloader.ts     # Backend download logic
│   ├── ValkeyDownloader.ts      # Valkey download logic
│   ├── DownloaderManager.ts     # Download coordination
│   ├── BackendSetupManager.ts   # Setup wizard logic
│   └── *.html, *.css            # UI files for setup wizards
├── scripts/                      # Build and dev scripts
│   ├── dev.js                   # Development script
│   └── dev-simple.js            # Simple dev script
├── dist/                         # Compiled output (gitignored)
├── package.json                  # Electron app dependencies
└── tsconfig.json                 # TypeScript configuration
```

## Configuration

The electron build configuration is in `package.json` under the `build` key:

- **appId**: com.cupcake.app
- **productName**: Cupcake
- **Output formats**:
  - Windows: NSIS installer, portable, zip
  - macOS: DMG for x64 and ARM64
  - Linux: AppImage, tar.gz

## Environment Variables

The Electron app uses `environment.electron.ts` which configures:

- API URL: `http://localhost:8000/api/v1`
- WebSocket URL: `ws://localhost:8000/ws`
- Feature flags
- Electron mode flag

## Troubleshooting

### Build fails

1. Ensure all dependencies are installed: `npm install` in both root and electron-app
2. Check that TypeScript compiles without errors: `cd electron-app && npm run compile`
3. Verify Angular builds correctly: `ng build --configuration=electron`

### Electron doesn't start

1. Check that the backend is running if using dev server mode
2. Verify port 8000 is available for the backend
3. Check console logs in the Electron developer tools

### Backend download fails

1. Check internet connection
2. Verify GitHub access (backend is downloaded from GitHub releases)
3. Check available disk space

## Notes

- The Electron app automatically manages the backend lifecycle
- First run will download required components (backend, Python, Redis/Valkey)
- User data is stored in the system's application data directory
- Logs are available in the developer console and system logs
