import type { Transaction } from './types';

type OutgoingTransactionMessageType =
  | 'transaction:add'
  | 'transaction:edit'
  | 'transaction:delete';

type OutgoingBudgetMessageType =
  | 'budget:add'
  | 'budget:edit'
  | 'budget:delete';

type OutgoingRealtimeMessageType = OutgoingTransactionMessageType | OutgoingBudgetMessageType;

type IncomingTransactionAction = 'add' | 'edit' | 'delete';
type IncomingBudgetAction = 'add' | 'edit' | 'delete';
type IncomingResource = 'transaction' | 'budget';

type IncomingRealtimeAction = IncomingTransactionAction | IncomingBudgetAction;

const SUPPORTED_INCOMING_RESOURCES = new Set<IncomingResource>(['transaction', 'budget']);

export interface IncomingRealtimeUpdate {
  type: 'transaction:update' | 'budget:update';
  resource: IncomingResource;
  action: IncomingRealtimeAction;
  payload: unknown;
  sourceClientId?: string;
  timestamp?: string;
}

export interface IncomingTransactionUpdate {
  type: 'transaction:update';
  action: IncomingTransactionAction;
  payload: unknown;
  sourceClientId?: string;
  timestamp?: string;
}

export interface IncomingBudgetUpdate {
  type: 'budget:update';
  action: IncomingBudgetAction;
  payload: unknown;
  sourceClientId?: string;
  timestamp?: string;
}

type RealtimeUpdateListener = (message: IncomingRealtimeUpdate) => void;
type TransactionUpdateListener = (message: IncomingTransactionUpdate) => void;
type BudgetUpdateListener = (message: IncomingBudgetUpdate) => void;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080';
const RECONNECT_DELAY_MS = 1500;

const listeners = new Set<RealtimeUpdateListener>();
const queuedMessages: string[] = [];

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;

function needsConnection(): boolean {
  return listeners.size > 0 || queuedMessages.length > 0;
}

function clearReconnectTimer() {
  if (reconnectTimer === null) {
    return;
  }

  window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function scheduleReconnect() {
  if (typeof window === 'undefined' || reconnectTimer !== null || !needsConnection()) {
    return;
  }

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;

    if (needsConnection()) {
      connect();
    }
  }, RECONNECT_DELAY_MS);
}

function flushQueue() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  while (queuedMessages.length > 0) {
    const next = queuedMessages.shift();

    if (next) {
      socket.send(next);
    }
  }
}

function parseIncomingMessage(rawData: string): IncomingRealtimeUpdate | null {
  try {
    const parsed = JSON.parse(rawData) as Partial<IncomingRealtimeUpdate>;
    if (typeof parsed.type !== 'string') {
      return null;
    }

    const [resource, updateMarker] = parsed.type.split(':');
    if (!resource || updateMarker !== 'update') {
      return null;
    }

    if (!SUPPORTED_INCOMING_RESOURCES.has(resource as IncomingResource)) {
      return null;
    }

    if (parsed.action !== 'add' && parsed.action !== 'edit' && parsed.action !== 'delete') {
      return null;
    }

    return {
      type: parsed.type as IncomingRealtimeUpdate['type'],
      resource: resource as IncomingResource,
      action: parsed.action,
      payload: parsed.payload ?? null,
      sourceClientId: typeof parsed.sourceClientId === 'string' ? parsed.sourceClientId : undefined,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : undefined,
    };
  } catch {
    return null;
  }
}

function connect() {
  if (typeof window === 'undefined') {
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  clearReconnectTimer();

  socket = new WebSocket(WS_URL);

  socket.addEventListener('open', () => {
    flushQueue();
  });

  socket.addEventListener('message', (event: MessageEvent) => {
    if (typeof event.data !== 'string') {
      return;
    }

    const parsed = parseIncomingMessage(event.data);

    if (!parsed) {
      return;
    }

    for (const listener of listeners) {
      listener(parsed);
    }
  });

  socket.addEventListener('close', () => {
    socket = null;

    if (needsConnection()) {
      scheduleReconnect();
    }
  });

  socket.addEventListener('error', () => {
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
  });
}

function publish(type: OutgoingRealtimeMessageType, payload: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  queuedMessages.push(
    JSON.stringify({
      type,
      payload,
    })
  );

  connect();
  flushQueue();
}

export function subscribeAppUpdates(listener: RealtimeUpdateListener) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  listeners.add(listener);
  connect();

  return () => {
    listeners.delete(listener);

    if (!needsConnection()) {
      clearReconnectTimer();

      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }

      socket = null;
    }
  };
}

export function subscribeTransactionUpdates(listener: TransactionUpdateListener) {
  return subscribeAppUpdates((message) => {
    if (message.resource !== 'transaction') {
      return;
    }

    listener({
      type: 'transaction:update',
      action: message.action,
      payload: message.payload,
      sourceClientId: message.sourceClientId,
      timestamp: message.timestamp,
    });
  });
}

export function subscribeBudgetUpdates(listener: BudgetUpdateListener) {
  return subscribeAppUpdates((message) => {
    if (message.resource !== 'budget') {
      return;
    }

    listener({
      type: 'budget:update',
      action: message.action,
      payload: message.payload,
      sourceClientId: message.sourceClientId,
      timestamp: message.timestamp,
    });
  });
}

export function publishTransactionAdd(transaction: Transaction) {
  publish('transaction:add', transaction);
}

export function publishTransactionEdit(transaction: Transaction) {
  publish('transaction:edit', transaction);
}

export function publishTransactionDelete(transactionId: string) {
  publish('transaction:delete', { id: transactionId });
}

export function publishBudgetAdd(payload: unknown) {
  publish('budget:add', payload);
}

export function publishBudgetEdit(payload: unknown) {
  publish('budget:edit', payload);
}

export function publishBudgetDelete(budgetId: string) {
  publish('budget:delete', { id: budgetId });
}
