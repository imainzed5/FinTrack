'use client';

import Link from 'next/link';
import {
  ArrowLeft,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import BerdeSprite from '@/components/BerdeSprite';
import BerdeChatComposer from '@/components/berde-chat/BerdeChatComposer';
import BerdeChatThread from '@/components/berde-chat/BerdeChatThread';
import { useAppSession } from '@/components/AppSessionProvider';
import { parseBerdeChatInput } from '@/lib/berde/chat-parser';
import type {
  BerdeChatIntent,
  BerdeParsedActionBatch,
} from '@/lib/berde/chat.types';
import { executeParsedAction, loadBerdeChatContextData } from '@/lib/berde/chat/executor';
import {
  getDraftVoiceLine,
  getLoggedVoiceLine,
  getPreviewCardText,
  getSessionSummary,
} from '@/lib/berde/chat/presenters';
import {
  clearInteractiveState,
  deriveFirstName,
  findLatestPendingPreviewMessage,
  readStoredState,
  SESSION_STORAGE_KEY,
} from '@/lib/berde/chat/session';
import type { BerdeChatMessage, PreviewState, StoredChatState } from '@/lib/berde/chat/thread';
import { createMessageId } from '@/lib/berde/chat/thread';
import {
  EXAMPLE_PROMPTS,
  MOBILE_EXAMPLE_PROMPTS,
  POST_SAVE_REPLY_INPUTS,
  STARTER_REPLY_INPUTS,
} from '@/lib/berde/chat/ui-config';
import type {
  Account,
  Debt,
  SavingsGoal,
  Transaction,
} from '@/lib/types';

export default function BerdeChatClientPage() {
  const { viewer } = useAppSession();
  const firstName = useMemo(() => deriveFirstName(viewer.displayName), [viewer.displayName]);
  const initialState = useMemo(() => readStoredState(firstName), [firstName]);
  const [messages, setMessages] = useState<BerdeChatMessage[]>(initialState.messages);
  const [activeIntent, setActiveIntent] = useState<BerdeChatIntent | null>(initialState.activeIntent);
  const [didClearThread, setDidClearThread] = useState(Boolean(initialState.didClearThread));
  const [input, setInput] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        messages,
        activeIntent,
        didClearThread,
      } satisfies StoredChatState),
    );
  }, [activeIntent, didClearThread, messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const nextContext = await loadBerdeChatContextData();

        if (cancelled) {
          return;
        }

        setAccounts(nextContext.accounts);
        setRecentTransactions(nextContext.recentTransactions);
        setSavingsGoals(nextContext.savingsGoals);
        setDebts(nextContext.debts);
      } finally {
        // no-op: context data is consumed locally after load
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  const focusedAction = useMemo(() => {
    if (!activeIntent?.batch || activeIntent.stage !== 'collecting_field') {
      return null;
    }
    const index = activeIntent.batch.focusActionIndex;
    if (index === undefined) {
      return null;
    }
    return {
      action: activeIntent.batch.actions[index],
      index,
      total: activeIntent.batch.actions.length,
    };
  }, [activeIntent]);

  const sessionSummary = useMemo(() => getSessionSummary(messages), [messages]);

  const pushParserResponse = (parserResult: ReturnType<typeof parseBerdeChatInput>) => {
    setMessages((current) => {
      const nextMessages = clearInteractiveState(current);
      if ((parserResult.intent.kind === 'action_batch' || parserResult.intent.kind === 'confirm') && parserResult.intent.batch) {
        const previewState: PreviewState = { kind: 'pending' };
        nextMessages.push({
          id: createMessageId('preview'),
          role: 'berde',
          kind: 'preview',
          text: getDraftVoiceLine(parserResult.intent.batch, parserResult.intent.confidenceLabel),
          batch: parserResult.intent.batch,
          confidenceLabel: parserResult.intent.confidenceLabel,
          previewState,
        });
      } else {
        nextMessages.push({
          id: createMessageId('berde'),
          role: 'berde',
          kind: 'text',
          text: parserResult.replyText,
          spriteState: parserResult.intent.stage === 'collecting_field' ? 'helper' : 'neutral',
          quickReplies: parserResult.intent.quickReplies,
        });
      }
      return nextMessages;
    });

    setActiveIntent(parserResult.intent.kind === 'unsupported' ? null : parserResult.intent);
    setDidClearThread(false);
  };

  const submitMessage = (nextInput?: string) => {
    const rawMessage = (nextInput ?? input).trim();
    if (!rawMessage || savingMessageId) {
      return;
    }

    if (rawMessage.toLowerCase() === 'cancel') {
      setMessages((current) => [
        ...clearInteractiveState(current),
        {
          id: createMessageId('user'),
          role: 'user',
          kind: 'text',
          text: rawMessage,
        },
      ]);
      setInput('');
      setDidClearThread(false);
      handleDismissPendingIntent();
      return;
    }

    const userMessage: BerdeChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      kind: 'text',
      text: rawMessage,
    };

    const parserResult = parseBerdeChatInput(rawMessage, {
      accounts,
      savingsGoals,
      debts,
      recentTransactions,
      now: new Date(),
      pendingBatch: activeIntent?.batch ?? null,
      pendingIntent: activeIntent,
    });

    setMessages((current) => [...clearInteractiveState(current), userMessage]);
    setInput('');
    setDidClearThread(false);

    if (parserResult.intent.kind === 'confirm' && parserResult.intent.batch) {
      void handleImplicitConfirm(parserResult.intent.batch);
      return;
    }

    pushParserResponse(parserResult);
  };

  const handleClearChat = () => {
    setMessages([]);
    setActiveIntent(null);
    setInput('');
    setDidClearThread(true);
  };

  const handleImplicitConfirm = async (batch: BerdeParsedActionBatch) => {
    const syntheticId = createMessageId('preview');
    const previewState: PreviewState = { kind: 'pending' };
    setMessages((current) => [
      ...clearInteractiveState(current),
      {
        id: syntheticId,
        role: 'berde',
        kind: 'preview',
        text: getDraftVoiceLine(batch, 'high'),
        batch,
        confidenceLabel: 'high',
        previewState,
      },
    ]);
    await handleConfirmBatch(syntheticId, batch);
  };

  const handleConfirmBatch = async (messageId: string, batch: BerdeParsedActionBatch) => {
    setSavingMessageId(messageId);

    try {
      for (const action of batch.actions) {
        await executeParsedAction(action);
      }

      setMessages((current): BerdeChatMessage[] => {
        return clearInteractiveState(current).map((message): BerdeChatMessage => {
          if (message.kind !== 'preview' || message.id !== messageId) {
            return message;
          }

          const previewState: PreviewState = { kind: 'logged' };
          return {
            ...message,
            previewState,
            text: getLoggedVoiceLine(batch),
            quickReplies: ['Add another', 'Log income', 'Move money'],
          };
        });
      });
      setActiveIntent(null);

      const nextContext = await loadBerdeChatContextData();
      setAccounts(nextContext.accounts);
      setRecentTransactions(nextContext.recentTransactions);
      setSavingsGoals(nextContext.savingsGoals);
      setDebts(nextContext.debts);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Something went wrong while saving that transaction.';
      setMessages((current) => [
        ...clearInteractiveState(current),
        {
          id: createMessageId('berde'),
          role: 'berde',
          kind: 'text',
          text: `I couldn't save that yet. ${message}`,
          spriteState: 'helper',
        },
      ]);
    } finally {
      setSavingMessageId(null);
    }
  };

  const handleCancelBatch = (messageId: string) => {
    setMessages((current): BerdeChatMessage[] => {
      const updatedMessages = clearInteractiveState(current).map((message): BerdeChatMessage => {
        if (message.kind !== 'preview' || message.id !== messageId) {
          return message;
        }

        const previewState: PreviewState = { kind: 'cancelled' };
        return {
          ...message,
          previewState,
          text: getPreviewCardText(previewState),
          quickReplies: [],
        };
      });

      return [
        ...updatedMessages,
        {
          id: createMessageId('berde'),
          role: 'berde',
          kind: 'text',
          text: 'Canceled. Nothing was saved.',
          spriteState: 'neutral',
        },
      ];
    });
    setActiveIntent(null);
  };

  const handleDismissPendingIntent = () => {
    const pendingPreview = findLatestPendingPreviewMessage(messages);
    if (pendingPreview) {
      handleCancelBatch(pendingPreview.id);
      return;
    }

    if (!activeIntent) {
      return;
    }

    setMessages((current) => [
      ...clearInteractiveState(current),
      {
        id: createMessageId('berde'),
        role: 'berde',
        kind: 'text',
        text: 'Canceled. I cleared that pending chat flow.',
        spriteState: 'neutral',
      },
    ]);
    setActiveIntent(null);
  };

  const handleQuickReply = (value: string) => {
    if (value in STARTER_REPLY_INPUTS) {
      setInput(STARTER_REPLY_INPUTS[value as keyof typeof STARTER_REPLY_INPUTS]);
      composerRef.current?.focus();
      return;
    }

    if (value in POST_SAVE_REPLY_INPUTS) {
      setInput(POST_SAVE_REPLY_INPUTS[value as keyof typeof POST_SAVE_REPLY_INPUTS]);
      composerRef.current?.focus();
      return;
    }

    if (value.trim().toLowerCase() === 'cancel') {
      handleDismissPendingIntent();
      return;
    }

    submitMessage(value);
  };

  const handleExamplePrompt = (value: string) => {
    submitMessage(value);
  };

  const handleStarterPrompt = (value: string, mode: 'submit' | 'seed') => {
    if (mode === 'submit') {
      submitMessage(value);
      return;
    }

    if (value in STARTER_REPLY_INPUTS) {
      setInput(STARTER_REPLY_INPUTS[value as keyof typeof STARTER_REPLY_INPUTS]);
      composerRef.current?.focus();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-5rem)] w-full flex-col overflow-hidden px-3 py-3 sm:h-dvh sm:px-5 sm:pb-6 md:py-5 lg:px-8">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
        <header className="w-full shrink-0">
          <div className="rounded-[22px] border border-[#c8e9dd] bg-[linear-gradient(180deg,#f3fff9_0%,#ffffff_100%)] p-3 shadow-[0_14px_28px_rgba(15,110,86,0.08)] md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                <ArrowLeft size={16} />
                Back
              </Link>
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                New chat
              </button>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <div className="rounded-2xl bg-[#0F6E56] p-2">
                <BerdeSprite state="neutral" size={42} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0F6E56]">
                  Berde Chat
                </p>
                <h1 className="mt-1 font-display text-xl font-semibold text-zinc-900">
                  Chat with Berde
                </h1>
                <p className="mt-1 text-sm leading-5 text-zinc-600">
                  Draft first, save after you confirm.
                </p>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
              {MOBILE_EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={`mobile-${example}`}
                  type="button"
                  onClick={() => handleExamplePrompt(example)}
                  className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
                >
                  {example}
                </button>
              ))}
              </div>
            ) : null}
          </div>

          <div className="hidden md:block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ArrowLeft size={16} />
                Back to dashboard
              </Link>
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                New chat
              </button>
            </div>

            <div className="mt-3 rounded-[24px] border border-[#c8e9dd] bg-[linear-gradient(180deg,#f3fff9_0%,#ffffff_100%)] p-4 shadow-[0_18px_40px_rgba(15,110,86,0.08)] sm:p-5 lg:rounded-[30px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="rounded-2xl bg-[#0F6E56] p-2">
                <BerdeSprite state="neutral" size={54} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0F6E56]">
                  Berde Chat
                </p>
                <h1 className="mt-1 font-display text-2xl font-semibold text-zinc-900">
                  Talk to Berde
                </h1>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Draft first, save after you confirm.
                </p>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleExamplePrompt(example)}
                    className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            ) : null}
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[#dfe7e3] bg-[rgba(255,255,255,0.78)] shadow-[0_18px_36px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:rounded-[32px]">
          <BerdeChatThread
            messages={messages}
            sessionSummary={sessionSummary}
            didClearThread={didClearThread}
            savingMessageId={savingMessageId}
            threadEndRef={threadEndRef}
            onStarterPrompt={handleStarterPrompt}
            onQuickReply={handleQuickReply}
            onConfirmBatch={handleConfirmBatch}
            onCancelBatch={handleCancelBatch}
          />

          <BerdeChatComposer
            activeIntent={activeIntent}
            focusedAction={focusedAction}
            input={input}
            savingMessageId={savingMessageId}
            composerRef={composerRef}
            onInputChange={setInput}
            onQuickReply={handleQuickReply}
            onSubmit={() => submitMessage()}
          />
        </section>
      </div>
    </div>
  );
}
