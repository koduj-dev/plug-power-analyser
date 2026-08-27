import fs from 'node:fs';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { childLogger } from '../../util/logger.js';

const log = childLogger('http.staticFrontend');

export async function registerStaticFrontend(app: FastifyInstance, distPath: string): Promise<void> {
  if (!fs.existsSync(distPath)) {
    log.warn({ distPath }, 'Frontend build output not found; run the frontend build or use the Vite dev server');
    return;
  }

  await app.register(fastifyStatic, { root: distPath });

  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith('/api') || request.raw.url?.startsWith('/ws')) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    reply.type('text/html').send(fs.readFileSync(path.join(distPath, 'index.html')));
  });
}
