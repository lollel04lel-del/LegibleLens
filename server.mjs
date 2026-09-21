import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
const filename = fileURLToPath(import.meta.url);
const root = path.dirname(filename);
const webRoot = path.join(root, 'dist', 'web');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.gz':'application/gzip'};
export function route(url) {
  const p = new URL(url, 'http://localhost').pathname;
  const target = path.resolve(webRoot, p === '/' ? 'index.html' : `.${p}`);
  return target === webRoot || target.startsWith(`${webRoot}${path.sep}`) ? target : null;
}
export function createServer() {
  return http.createServer(async (req, res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    const target = route(req.url);
    if (!target) { res.writeHead(404); res.end('Not found'); return; }
    const data = await readFile(target);
    res.writeHead(200, {'Content-Type':types[path.extname(target)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':target.includes('traineddata')?'public, max-age=86400':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = createServer();
  server.listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log('LegibleLens listening on port ' + server.address().port));
}
