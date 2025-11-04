const { spawn } = require('child_process');
const waitOn = require('wait-on');

console.log('Cupcake Vanilla Electron - Simple Development Mode');
console.log('Make sure Angular dev server is running at http://localhost:4200');
console.log('If not, run "npm start" in the root directory first.');
console.log('');

// Check if Angular dev server is already running
console.log('Checking if Angular dev server is available...');
waitOn({
  resources: ['http://localhost:4200'],
  delay: 1000,
  interval: 1000,
  timeout: 10000
}).then(() => {
  console.log('✓ Angular dev server found at http://localhost:4200');
  console.log('Starting Electron...');

  // Start Electron
  const electron = spawn('electron', ['.', '--dev', '--allow-self-signed'], {
    cwd: __dirname + '/..',
    stdio: 'inherit',
    shell: true
  });

  electron.on('close', (code) => {
    console.log(`Electron exited with code ${code}`);
    process.exit(code);
  });

}).catch((err) => {
  console.error('✗ Angular dev server not found at http://localhost:4200');
  console.error('');
  console.error('Please start the Angular dev server first:');
  console.error('  1. Open a new terminal');
  console.error('  2. Navigate to the root directory');
  console.error('  3. Run: npm start');
  console.error('  4. Wait for it to say "compiled successfully"');
  console.error('  5. Then run this command again');
  console.error('');
  console.error('Or use the automatic mode: npm run dev:auto');
  process.exit(1);
});
