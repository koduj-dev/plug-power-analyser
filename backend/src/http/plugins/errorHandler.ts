import type { FastifyError, FastifyInstance } from 'fastify';
import { HttpError } from '../errors.js';
import { ShellyAuthError, ShellyHttpError, ShellyNetworkError } from '../../shelly/errors.js';
import { childLogger } from '../../util/logger.js';

const log = childLogger('http.errorHandler');

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | Error, request, reply) => {
    if (err instanceof HttpError) {
      reply.code(err.statusCode).send({ error: err.message });
      return;
    }
    if (err instanceof ShellyAuthError) {
      reply.code(401).send({ error: err.message });
      return;
    }
    if (err instanceof ShellyNetworkError || err instanceof ShellyHttpError) {
      reply.code(502).send({ error: err.message });
      return;
    }
    if ('validation' in err && err.validation) {
      reply.code(400).send({ error: err.message });
      return;
    }
    log.error({ err, url: request.url }, 'Unhandled request error');
    reply.code(500).send({ error: 'Internal server error' });
  });
}
