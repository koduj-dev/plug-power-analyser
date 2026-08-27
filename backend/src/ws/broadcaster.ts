import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { childLogger } from '../util/logger.js';
import type { DeviceStatus } from '../domain/types.js';

const log = childLogger('ws.broadcaster');

export interface DeviceStatusMessage {
  type: 'device.status';
  deviceId: number;
  timestamp: number;
  power: number | null;
  voltage: number | null;
  current: number | null;
  frequency: number | null;
  temperature: number | null;
  energyTotal: number | null;
  output: boolean | null;
}

export interface DeviceStateMessage {
  type: 'device.state';
  deviceId: number;
  status: DeviceStatus;
  consecutiveFailures: number;
  lastError: string | null;
}

export type BroadcastMessage = DeviceStatusMessage | DeviceStateMessage;

export class Broadcaster {
  private readonly wss: WebSocketServer;

  constructor(httpServer: HttpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    this.wss.on('connection', (socket) => {
      log.debug('Client connected');
      socket.on('error', (err) => log.warn({ err }, 'WebSocket client error'));
    });
    this.wss.on('error', (err) => log.error({ err }, 'WebSocket server error'));
  }

  broadcast(message: BroadcastMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  close(): void {
    this.wss.close();
  }
}
