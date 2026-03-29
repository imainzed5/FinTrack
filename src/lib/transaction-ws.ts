'use client';

import { getSupabaseBrowserClient } from './supabase/client';

// ─── Public Types ────────────────────────────────────────────────────────────

export type IncomingResourceType = 'transaction' | 'budget';
export type IncomingAction = 'add' | 'edit' | 'delete';

export interface IncomingRealtimeUpdate {
  type: 'transaction:update' | 'budget:update';
  resource: IncomingResourceType;
  action: IncomingAction;
  payload: unknown;
  timestamp?: string;
}

export interface IncomingTransactionUpdate {
  type: 'transaction:update';
  action: IncomingAction;
  payload: unknown;
  timestamp?: string;
}

export interface IncomingBudgetUpdate {
  type: 'budget:update';
  action: IncomingAction;
  payload: unknown;
  timestamp?: string;
}

type RealtimeUpdateListener = (message: IncomingRealtimeUpdate) => void;
type TransactionUpdateListener = (message: IncomingTransactionUpdate) => void;
type BudgetUpdateListener = (message: IncomingBudgetUpdate) => void;

const LOCAL_BROADCAST_CHANNEL_NAME = 'moneda-local-updates';

// ─── Internal Postgres event → action mapping ────────────────────────────────

type PostgresEventType = 'INSERT' | 'UPDATE' | 'DELETE';

function pgEventToAction(event: PostgresEventType): IncomingAction {
  if (event === 'INSERT') return 'add';
  if (event === 'DELETE') return 'delete';
  return 'edit';
}

// ─── Subscription management ─────────────────────────────────────────────────

const listeners = new Set<RealtimeUpdateListener>();

let channelRef: ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null = null;
let localBroadcastChannel: BroadcastChannel | null = null;

function dispatchToListeners(update: IncomingRealtimeUpdate) {
  for (const listener of listeners) {
    listener(update);
  }
}

function ensureLocalBroadcastChannel() {
  if (typeof window === 'undefined') return;
  if (localBroadcastChannel) return;

  localBroadcastChannel = new BroadcastChannel(LOCAL_BROADCAST_CHANNEL_NAME);
  localBroadcastChannel.addEventListener('message', (event: MessageEvent<IncomingRealtimeUpdate>) => {
    if (!event.data) return;
    dispatchToListeners(event.data);
  });
}

function broadcastLocalUpdate(update: IncomingRealtimeUpdate) {
  dispatchToListeners(update);
  ensureLocalBroadcastChannel();
  localBroadcastChannel?.postMessage(update);
}

function ensureChannel() {
  if (typeof window === 'undefined') return;
  if (channelRef) return;

  const supabase = getSupabaseBrowserClient();

  channelRef = supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      (payload) => {
        dispatchToListeners({
          type: 'transaction:update',
          resource: 'transaction',
          action: pgEventToAction(payload.eventType as PostgresEventType),
          payload: payload.new ?? payload.old,
          timestamp: new Date().toISOString(),
        });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'budgets' },
      (payload) => {
        dispatchToListeners({
          type: 'budget:update',
          resource: 'budget',
          action: pgEventToAction(payload.eventType as PostgresEventType),
          payload: payload.new ?? payload.old,
          timestamp: new Date().toISOString(),
        });
      }
    )
    .subscribe();
}

function teardownChannelIfIdle() {
  if (listeners.size > 0 || !channelRef) return;

  const supabase = getSupabaseBrowserClient();
  void supabase.removeChannel(channelRef);
  channelRef = null;
}

// ─── Public subscribe API (matches legacy interface) ─────────────────────────

export function subscribeAppUpdates(listener: RealtimeUpdateListener): () => void {
  if (typeof window === 'undefined') return () => {};

  listeners.add(listener);
  ensureLocalBroadcastChannel();
  ensureChannel();

  return () => {
    listeners.delete(listener);
    teardownChannelIfIdle();
  };
}

export function subscribeTransactionUpdates(listener: TransactionUpdateListener): () => void {
  return subscribeAppUpdates((message) => {
    if (message.resource !== 'transaction') return;
    listener({
      type: 'transaction:update',
      action: message.action,
      payload: message.payload,
      timestamp: message.timestamp,
    });
  });
}

export function subscribeBudgetUpdates(listener: BudgetUpdateListener): () => void {
  return subscribeAppUpdates((message) => {
    if (message.resource !== 'budget') return;
    listener({
      type: 'budget:update',
      action: message.action,
      payload: message.payload,
      timestamp: message.timestamp,
    });
  });
}

// ─── Legacy publish stubs (no-ops – Supabase broadcasts natively) ─────────────

export function publishTransactionAdd(payload: unknown): void {
  broadcastLocalUpdate({
    type: 'transaction:update',
    resource: 'transaction',
    action: 'add',
    payload,
    timestamp: new Date().toISOString(),
  });
}

export function publishTransactionEdit(payload: unknown): void {
  broadcastLocalUpdate({
    type: 'transaction:update',
    resource: 'transaction',
    action: 'edit',
    payload,
    timestamp: new Date().toISOString(),
  });
}

export function publishTransactionDelete(id: string): void {
  broadcastLocalUpdate({
    type: 'transaction:update',
    resource: 'transaction',
    action: 'delete',
    payload: { id },
    timestamp: new Date().toISOString(),
  });
}

export function publishBudgetAdd(payload: unknown): void {
  broadcastLocalUpdate({
    type: 'budget:update',
    resource: 'budget',
    action: 'add',
    payload,
    timestamp: new Date().toISOString(),
  });
}

export function publishBudgetEdit(payload: unknown): void {
  broadcastLocalUpdate({
    type: 'budget:update',
    resource: 'budget',
    action: 'edit',
    payload,
    timestamp: new Date().toISOString(),
  });
}

export function publishBudgetDelete(id: string): void {
  broadcastLocalUpdate({
    type: 'budget:update',
    resource: 'budget',
    action: 'delete',
    payload: { id },
    timestamp: new Date().toISOString(),
  });
}
