const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');

const rootDir = path.join(__dirname, '../..');

console.log('Starting Cupcake Vanilla Electron Development...');

// Start Angular dev server
console.log('Starting Angular dev server...');
const ngServe = spawn('npm', ['start'], {
  cwd: rootDir,
  stdio: 'pipe',
  shell: true
});

ngServe.stdout.on('data', (data) => {
  console.log(`[Angular] ${data.toString().trim()}`);
});

ngServe.stderr.on('data', (data) => {
  console.error(`[Angular Error] ${data.toString().trim()}`);
});

// Wait for Angular dev server to be ready
console.log('Waiting for Angular dev server to start...');
console.log('This may take a few minutes as it builds all libraries first...');
waitOn({
  resources: ['http://localhost:4200'],
  delay: 2000,
  interval: 2000,
  timeout: 300000  // 5 minutes timeout to allow for library builds
}).then(() => {
  console.log('Angular dev server is ready!');
  console.log('Starting Electron...');

  // Start Electron
  const electron = spawn('electron', ['.', '--dev'], {
    cwd: __dirname + '/..',
    stdio: 'inherit',
    shell: true
  });

  electron.on('close', () => {
    console.log('Electron closed, stopping Angular dev server...');
    ngServe.kill();
    process.exit(0);
  });

}).catch((err) => {
  console.error('Error waiting for Angular dev server:', err);
  ngServe.kill();
  process.exit(1);
});