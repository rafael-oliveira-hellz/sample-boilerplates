import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

process.env.CHROME_BIN = chromium.executablePath();

const args = process.argv.slice(2);
const child = spawn('npx', ['ng', 'test', ...args], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
