import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerErrorHandler } from './plugins/errorHandler.js';
import { registerStaticFrontend } from './plugins/staticFrontend.js';
import { registerDeviceRoutes } from './routes/devices.routes.js';
import type { DeviceRoutesDeps } from './routes/devices.routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { pinoOptions } from '../util/logger.js';

export function createFastifyApp(): FastifyInstance {
  const app = Fastify({ logger: pinoOptions() });
  registerErrorHandler(app);
  registerHealthRoutes(app);
  return app;
}

export interface RegisterAppRoutesOptions extends DeviceRoutesDeps {
  frontendDistPath: string;
  serveFrontend: boolean;
}

export async function registerAppRoutes(app: FastifyInstance, options: RegisterAppRoutesOptions): Promise<void> {
  registerDeviceRoutes(app, options);
  if (options.serveFrontend) {
    await registerStaticFrontend(app, options.frontendDistPath);
  }
}
