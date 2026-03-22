import { createServer } from 'vite';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = await createServer({
  configFile: __dirname + '/vite.config.js',
  root: __dirname,
  server: { port: 5173, strictPort: true }
});
await server.listen();
server.printUrls();
