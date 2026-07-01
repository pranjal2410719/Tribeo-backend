import { buildServer } from './app';

(async () => {
  const server = await buildServer();
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info(`🚀 Server listening at http://localhost:${port}`);
  server.log.info(`📚 API docs at http://localhost:${port}/api/v1/docs`);

  process.on('SIGTERM', async () => { await server.close(); process.exit(0); });
  process.on('SIGINT', async () => { await server.close(); process.exit(0); });
})();
