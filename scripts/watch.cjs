const { spawn } = require('node:child_process');

// Compile sources continuously; Node restarts Homebridge when its loaded JS changes.
const children = [
  spawn(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '--watch', '--noEmitOnError', '--preserveWatchOutput',
  ], { stdio: 'inherit' }),
  spawn(process.execPath, [
    '--watch', '--watch-preserve-output', '--trace-warnings',
    require.resolve('homebridge/bin/homebridge'), '-I', '-D',
  ], { stdio: 'inherit' }),
];

let stopping = false;
function stop(code) {
  if (stopping) {
    return;
  }
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
  }
}

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
for (const child of children) {
  child.on('error', (error) => {
    console.error(error);
    stop(1);
  });
  child.on('exit', (code) => stop(code ?? 1));
}
