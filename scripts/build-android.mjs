import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const child = spawn(command, ['assembleDebug'], {
  cwd: path.join(root, 'android'),
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
child.on('exit', code => process.exit(code ?? 1));
