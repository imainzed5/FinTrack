import type { BerdeChatIntent } from '@/lib/berde/chat.types';
import { EXAMPLE_PROMPTS } from '@/lib/berde/chat/ui-config';
import {
  type BerdeChatMessage,
  type LegacyPreviewStatus,
  type StoredChatState,
  createMessageId,
  normalizePreviewState,
} from '@/lib/berde/chat/thread';

export const SESSION_STORAGE_KEY = 'berde-chat-session-v4';

export function deriveFirstName(value: string): string {
  const normalized = value.includes('@') ? value.split('@')[0] : value;
  const firstToken = normalized.trim().split(/\s+/)[0];
  return firstToken || 'there';
}

export function createWelcomeMessages(firstName: string): BerdeChatMessage[] {
  return [
    {
      id: createMessageId('berde'),
      role: 'berde',
      kind: 'text',
      text: `Hi ${firstName}. Tell me what you spent or earned, and I'll turn it into a draft before anything gets saved.`,
      spriteState: 'helper',
    },
    {
      id: createMessageId('berde'),
      role: 'berde',
      kind: 'text',
      text: `Try messages like "${EXAMPLE_PROMPTS[0]}", "${EXAMPLE_PROMPTS[1]}", or "${EXAMPLE_PROMPTS[2]}".`,
      spriteState: 'neutral',
    },
  ];
}

function migrateStoredMessage(rawMessage: unknown): BerdeChatMessage | null {
  if (!rawMessage || typeof rawMessage !== 'object') {
    return null;
  }

  const message = rawMessage as Record<string, unknown>;
  if (message.role !== 'berde' && message.role !== 'user') {
    return null;
  }
  if (message.kind !== 'text' && message.kind !== 'preview' && message.kind !== 'receipt') {
    return null;
  }
  if (typeof message.id !== 'string' || typeof message.text !== 'string') {
    return null;
  }

  if (message.kind === 'receipt') {
    const rawReceiptMeta =
      message.receiptMeta && typeof message.receiptMeta === 'object'
        ? (message.receiptMeta as Record<string, unknown>)
        : null;

    return {
      id: message.id,
      role: 'berde',
      kind: 'receipt',
      text: message.text,
      receiptMeta: rawReceiptMeta
        ? {
            actionKind:
              rawReceiptMeta.actionKind === 'expense' ||
              rawReceiptMeta.actionKind === 'income' ||
              rawReceiptMeta.actionKind === 'transfer' ||
              rawReceiptMeta.actionKind === 'savings_deposit' ||
              rawReceiptMeta.actionKind === 'savings_withdrawal' ||
              rawReceiptMeta.actionKind === 'debt_create' ||
              rawReceiptMeta.actionKind === 'debt_payment' ||
              rawReceiptMeta.actionKind === 'debt_settlement'
                ? rawReceiptMeta.actionKind
                : 'expense',
            amount: typeof rawReceiptMeta.amount === 'number' ? rawReceiptMeta.amount : undefined,
            label: typeof rawReceiptMeta.label === 'string' ? rawReceiptMeta.label : message.text,
            date: typeof rawReceiptMeta.date === 'string' ? rawReceiptMeta.date : new Date().toISOString(),
            batchId: typeof rawReceiptMeta.batchId === 'string' ? rawReceiptMeta.batchId : undefined,
          }
        : undefined,
      quickReplies: Array.isArray(message.quickReplies)
        ? message.quickReplies.filter((reply): reply is string => typeof reply === 'string')
        : undefined,
    };
  }

  if (message.kind === 'text') {
    return {
      id: message.id,
      role: message.role,
      kind: 'text',
      text: message.text,
      spriteState:
        message.spriteState === 'neutral' ||
        message.spriteState === 'helper' ||
        message.spriteState === 'excited'
          ? message.spriteState
          : undefined,
      quickReplies: Array.isArray(message.quickReplies)
        ? message.quickReplies.filter((reply): reply is string => typeof reply === 'string')
        : undefined,
    };
  }

  if (
    !message.batch ||
    typeof message.batch !== 'object' ||
    !('actions' in message.batch) ||
    !Array.isArray((message.batch as Record<string, unknown>).actions)
  ) {
    return null;
  }

  const previewState =
    message.previewState && typeof message.previewState === 'object' && 'kind' in message.previewState
      ? normalizePreviewState((message.previewState as Record<string, unknown>).kind as LegacyPreviewStatus)
      : normalizePreviewState(message.status as LegacyPreviewStatus | undefined);

  return {
    id: message.id,
    role: 'berde',
    kind: 'preview',
    text: message.text,
    batch: message.batch as BerdeChatMessage & { batch: BerdeChatMessage extends never ? never : never }['batch'],
    confidenceLabel:
      message.confidenceLabel === 'high' ||
      message.confidenceLabel === 'medium' ||
      message.confidenceLabel === 'low'
        ? message.confidenceLabel
        : 'medium',
    previewState,
    quickReplies: Array.isArray(message.quickReplies)
      ? message.quickReplies.filter((reply): reply is string => typeof reply === 'string')
      : undefined,
  } as BerdeChatMessage;
}

export function readStoredState(firstName: string): StoredChatState {
  if (typeof window === 'undefined') {
    return {
      messages: createWelcomeMessages(firstName),
      activeIntent: null,
      didClearThread: false,
    };
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return {
        messages: createWelcomeMessages(firstName),
        activeIntent: null,
        didClearThread: false,
      };
    }

    const parsed = JSON.parse(raw) as StoredChatState;
    if (!Array.isArray(parsed.messages)) {
      return {
        messages: createWelcomeMessages(firstName),
        activeIntent: null,
        didClearThread: false,
      };
    }

    const migratedMessages = parsed.messages
      .map((message) => migrateStoredMessage(message))
      .filter((message): message is BerdeChatMessage => message !== null);

    return {
      messages: migratedMessages.length > 0 ? migratedMessages : createWelcomeMessages(firstName),
      activeIntent: (parsed.activeIntent ?? null) as BerdeChatIntent | null,
      didClearThread: Boolean(parsed.didClearThread),
    };
  } catch {
    return {
      messages: createWelcomeMessages(firstName),
      activeIntent: null,
      didClearThread: false,
    };
  }
}

export function clearInteractiveState(messages: BerdeChatMessage[]): BerdeChatMessage[] {
  return messages.map((message) => {
    if (!message.quickReplies || message.quickReplies.length === 0) {
      return message;
    }

    return {
      ...message,
      quickReplies: [],
    };
  });
}

export function findLatestPendingPreviewMessage(
  messages: BerdeChatMessage[],
): Extract<BerdeChatMessage, { kind: 'preview' }> | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === 'preview' && message.previewState.kind === 'pending') {
      return message;
    }
  }

  return null;
}
