import { buildServer } from './app';

let app: any;

async function getApp() {
  if (!app) {
    app = await buildServer();
    await app.ready();
  }
  return app;
}

// Vercel serverless handler
export default async function handler(req: any, res: any) {
  const server = await getApp();
  server.server.emit('request', req, res);
}

// Local development — start server
const isVercel = process.env.VERCEL === '1';

if (!isVercel) {
  (async () => {
    const server = await buildServer();
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`🚀 Server listening at http://localhost:${port}`);
    server.log.info(`📚 API docs at http://localhost:${port}/api/v1/docs`);

    process.on('SIGTERM', async () => {
      await server.close();
      process.exit(0);
    });
    process.on('SIGINT', async () => {
      await server.close();
      process.exit(0);
    });
  })();
}
