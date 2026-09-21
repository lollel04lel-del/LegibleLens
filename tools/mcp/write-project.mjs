import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = JSON.parse(await readFile(process.argv[2], 'utf8'));
const client = new Client({ name: 'legiblelens-development', version: '1.0.0' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'tools/mcp/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js'), root] }));
  for (const [name, content] of Object.entries(files)) {
    const target = path.resolve(root, name);
    if (!target.startsWith(root + path.sep)) throw new Error('Path outside project');
    for (const [tool, args] of [['create_directory', { path: path.dirname(target) }], ['write_file', { path: target, content }]]) {
      const result = await client.callTool({ name: tool, arguments: args });
      if (result.isError) throw new Error(JSON.stringify(result));
    }
    console.log('MCP wrote', name);
  }
} finally { await client.close(); }
