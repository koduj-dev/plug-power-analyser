import { liveStore } from '../state/liveStore';
import type { WsMessage } from '../types';

const RECONNECT_DELAY_MS = 2000;

export function connectLiveSocket(): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (stopped) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data as string) as WsMessage;
        liveStore.applyMessage(message);
      } catch {
        // ignore malformed frames
      }
    });

    socket.addEventListener('close', () => {
      if (stopped) return;
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  }

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
