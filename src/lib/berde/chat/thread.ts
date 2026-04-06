import type { BerdeChatConfidenceLabel, BerdeChatIntent, BerdeParsedActionBatch } from '@/lib/berde/chat.types';

export type PreviewState =
  | { kind: 'pending' }
  | { kind: 'logged' }
  | { kind: 'cancelled' };

export type LegacyPreviewStatus = 'pending' | 'logged' | 'cancelled';

export type ReceiptMeta = {
  actionKind:
    | 'expense'
    | 'income'
    | 'transfer'
    | 'savings_deposit'
    | 'savings_withdrawal'
    | 'debt_create'
    | 'debt_payment'
    | 'debt_settlement';
  amount?: number;
  label: string;
  date: string;
  batchId?: string;
};

export type BerdeChatMessage =
  | {
      id: string;
      role: 'user' | 'berde';
      kind: 'text';
      text: string;
      spriteState?: 'neutral' | 'helper' | 'excited';
      quickReplies?: string[];
    }
  | {
      id: string;
      role: 'berde';
      kind: 'preview';
      text: string;
      batch: BerdeParsedActionBatch;
      confidenceLabel: BerdeChatConfidenceLabel;
      previewState: PreviewState;
      quickReplies?: string[];
    }
  | {
      id: string;
      role: 'berde';
      kind: 'receipt';
      text: string;
      receiptMeta?: ReceiptMeta;
      quickReplies?: string[];
    };

export interface StoredChatState {
  messages: BerdeChatMessage[];
  activeIntent: BerdeChatIntent | null;
  didClearThread?: boolean;
}

export function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePreviewState(status?: LegacyPreviewStatus): PreviewState {
  switch (status) {
    case 'logged':
      return { kind: 'logged' };
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'pending':
    default:
      return { kind: 'pending' };
  }
}
