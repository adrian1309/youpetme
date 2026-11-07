import { createServer, type Server } from 'node:http';

/**
 * A real page on another origin. It must be a real loopback server: Chromium blocks a page mocked
 * with page.route() from calling localhost (Local Network Access) before CORS is even consulted.
 */
export async function serveForeignPage(): Promise<Server> {
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Foreign</title>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

export function closeForeignPage(server: Server): void {
  server.closeAllConnections();
  server.close();
}
