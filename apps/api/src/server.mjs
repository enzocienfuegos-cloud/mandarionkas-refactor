import { createServer } from 'node:http';
import { createApp } from './app.mjs';
import { getApiConfig } from './plugins/config.mjs';
import { logError, logInfo } from './lib/logger.mjs';

const { env, warnings } = getApiConfig();
const app = createApp();
const server = createServer((req, res) => {
  app(req, res).catch((error) => {
    logError({ service: env.appName, message: 'Unhandled server error', error });
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, code: 'internal_error', message: 'Unhandled server error.' }));
  });
});

server.listen(env.port, () => {
  logInfo({
    service: env.appName,
    environment: env.appEnv,
    port: env.port,
    warnings,
    message: 'SMX API listening',
  });
});
