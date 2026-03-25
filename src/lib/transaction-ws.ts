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

function dispatchToListeners(update: IncomingRealtimeUpdate) {
  for (const listener of listeners) {
    listener(update);
  }
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

export function publishTransactionAdd(_payload: unknown): void {}
export function publishTransactionEdit(_payload: unknown): void {}
export function publishTransactionDelete(_id: string): void {}
export function publishBudgetAdd(_payload: unknown): void {}
export function publishBudgetEdit(_payload: unknown): void {}
export function publishBudgetDelete(_id: string): void {}
