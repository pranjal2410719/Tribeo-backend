import { buildServer } from '../dist/app';

let app: any;

async function getApp() {
  if (!app) {
    app = await buildServer();
    await app.ready();
  }
  return app;
}

export default async function handler(req: any, res: any) {
  const server = await getApp();
  server.server.emit('request', req, res);
}

export const config = {
  api: { bodyParser: false },
};
