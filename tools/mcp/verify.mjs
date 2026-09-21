import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = path.join(root, 'tools/mcp/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js');
const client = new Client({ name: 'legiblelens-connection-check', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [server, root], stderr: 'pipe' });
transport.stderr.on('data', chunk => process.stderr.write(chunk));
const call = async (name, args) => {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, JSON.stringify(result));
  return result.content.filter(x => x.type === 'text').map(x => x.text).join('\n');
};
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log('MCP handshake OK:', client.getServerVersion());
  console.log('Tools:', tools.map(x => x.name).join(', '));
  console.log(await call('list_allowed_directories', {}));
  const target = path.join(root, 'tools/mcp/connection-check.txt');
  await call('write_file', { path: target, content: 'LegibleLens MCP connection: pending\n' });
  await call('edit_file', { path: target, edits: [{ oldText: 'pending', newText: 'verified' }] });
  assert.equal((await call('read_text_file', { path: target })).trim(), 'LegibleLens MCP connection: verified');
  const denied = await client.callTool({ name: 'list_directory', arguments: { path: path.dirname(root) } });
  assert.equal(denied.isError, true, 'Parent directory must be denied');
  console.log('PASS: write, edit, read, and outside-workspace access denial.');
} finally {
  await client.close();
}
