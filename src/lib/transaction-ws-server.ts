import { WebSocket } from 'ws';

type OutgoingRealtimeMessageType =
  | 'transaction:add'
  | 'transaction:edit'
  | 'transaction:delete'
  | 'budget:add'
  | 'budget:edit'
  | 'budget:delete';

type OutgoingTransactionMessageType = Extract<OutgoingRealtimeMessageType, `transaction:${string}`>;
type OutgoingBudgetMessageType = Extract<OutgoingRealtimeMessageType, `budget:${string}`>;

const WS_URL = process.env.WS_BROADCAST_URL ?? process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080';
const CONNECT_TIMEOUT_MS = 1200;

export function broadcastRealtimeEvent(type: OutgoingRealtimeMessageType, payload: unknown) {
  try {
    const socket = new WebSocket(WS_URL);

    const timeout = setTimeout(() => {
      try {
        socket.close();
      } catch {
        // no-op
      }
    }, CONNECT_TIMEOUT_MS);

    socket.on('open', () => {
      try {
        socket.send(JSON.stringify({ type, payload }));
      } catch {
        // no-op
      } finally {
        clearTimeout(timeout);
        socket.close();
      }
    });

    socket.on('error', () => {
      clearTimeout(timeout);
    });

    socket.on('close', () => {
      clearTimeout(timeout);
    });
  } catch {
    // no-op
  }
}

export function broadcastTransactionEvent(type: OutgoingTransactionMessageType, payload: unknown) {
  broadcastRealtimeEvent(type, payload);
}

export function broadcastBudgetEvent(type: OutgoingBudgetMessageType, payload: unknown) {
  broadcastRealtimeEvent(type, payload);
}
