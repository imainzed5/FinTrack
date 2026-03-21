'use client';

import { type CSSProperties, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Archive,
  Lock,
  Pin,
  Plus,
  Target,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import type {
  SavingsDepositInput,
  SavingsGoalInput,
  SavingsGoalWithDeposits,
  SavingsGoalsSummary,
} from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import SavingsRatePopup from '@/components/dashboard/popups/SavingsRatePopup';

interface SavingsClientPageProps {
  data: SavingsGoalsSummary;
  savingsRate: number;
}

const EMOJI_PRESETS = ['🎯', '🏠', '✈️', '💻', '🚗', '📚', '💍', '🛍️'];
const COLOR_SWATCHES = ['#1D9E75', '#185FA5', '#EF9F27', '#D85A30', '#3C3489', '#0F766E'];
const QUICK_AMOUNTS = [100, 500, 1000, 2000];

function badgeStyles(health: SavingsGoalWithDeposits['health']): string {
  if (health === 'on_track') return 'bg-[#E1F5EE] text-[#1D9E75]';
  if (health === 'falling_behind') return 'bg-[#FFF2E0] text-[#B66A12]';
  if (health === 'at_risk') return 'bg-[#FDECEC] text-[#D85A30]';
  return 'bg-zinc-100 text-zinc-600';
}

function healthLabel(health: SavingsGoalWithDeposits['health']): string {
  if (health === 'on_track') return 'On track';
  if (health === 'falling_behind') return 'Falling behind';
  if (health === 'at_risk') return 'At risk';
  return 'No deadline';
}

function toMonthInputValue(deadline?: string): string {
  if (!deadline) return '';
  return deadline.slice(0, 7);
}

function formatDate(value?: string): string {
  if (!value) return 'No date';
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
}

export default function SavingsClientPage({ data, savingsRate }: SavingsClientPageProps) {
  const [summary, setSummary] = useState<SavingsGoalsSummary>(data);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoalWithDeposits | null>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddSavings, setShowAddSavings] = useState(false);
  const [showSavingsRatePopup, setShowSavingsRatePopup] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [goalForDeposit, setGoalForDeposit] = useState<SavingsGoalWithDeposits | null>(null);
  const [emojiCustom, setEmojiCustom] = useState(false);
  const [goalLoading, setGoalLoading] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [goalInput, setGoalInput] = useState<SavingsGoalInput>({
    name: '',
    emoji: '🎯',
    colorAccent: '#1D9E75',
    tag: '',
    motivationNote: '',
    targetAmount: 0,
    deadline: '',
    isPrivate: false,
    isPinned: false,
  });

  const [depositInput, setDepositInput] = useState<SavingsDepositInput>({
    goalId: '',
    amount: 0,
    type: 'deposit',
    note: '',
  });

  async function refreshSummary(): Promise<SavingsGoalsSummary> {
    const response = await fetch('/api/savings/goals', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to refresh goals.');
    }
    const nextSummary = (await response.json()) as SavingsGoalsSummary;
    setSummary(nextSummary);

    if (selectedGoal) {
      const refreshed = nextSummary.goals.find((goal) => goal.id === selectedGoal.id) ?? null;
      setSelectedGoal(refreshed);
    }

    return nextSummary;
  }

  const activeGoals = useMemo(
    () =>
      summary.goals
        .filter((goal) => goal.status === 'active')
        .slice()
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return b.progressPercent - a.progressPercent;
        }),
    [summary.goals]
  );

  const mutedGoals = useMemo(
    () => summary.goals.filter((goal) => goal.status === 'completed' || goal.status === 'archived'),
    [summary.goals]
  );

  async function submitNewGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGoalLoading(true);

    try {
      const payload: SavingsGoalInput = {
        ...goalInput,
        targetAmount: Number(goalInput.targetAmount),
        deadline: goalInput.deadline ? `${goalInput.deadline}-01` : undefined,
      };

      const response = await fetch('/api/savings/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create savings goal.');
      }

      await refreshSummary();
      setShowAddGoal(false);
      setGoalInput({
        name: '',
        emoji: '🎯',
        colorAccent: '#1D9E75',
        tag: '',
        motivationNote: '',
        targetAmount: 0,
        deadline: '',
        isPrivate: false,
        isPinned: false,
      });
    } finally {
      setGoalLoading(false);
    }
  }

  async function submitDeposit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goalForDeposit) return;

    setDepositLoading(true);

    try {
      const response = await fetch(`/api/savings/goals/${goalForDeposit.id}/deposits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: goalForDeposit.id,
          amount: Number(depositInput.amount),
          type: depositInput.type,
          note: depositInput.note,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add savings entry.');
      }

      const goalBefore = goalForDeposit;
      const nextSummary = await refreshSummary();
      const goalAfter = nextSummary.goals.find((goal) => goal.id === goalBefore.id);

      if (goalAfter && goalAfter.progressPercent >= 100 && goalBefore.progressPercent < 100) {
        sessionStorage.setItem('berde:savings-goal-hit', 'true');
      }

      const milestoneThresholds = [25, 50, 75];
      const crossedMilestone = milestoneThresholds.some(
        (threshold) => goalAfter && goalAfter.progressPercent >= threshold && goalBefore.progressPercent < threshold
      );
      if (crossedMilestone) {
        sessionStorage.setItem('berde:savings-milestone-hit', 'true');
      }

      setShowAddSavings(false);
      setGoalForDeposit(null);
      setDepositInput({ goalId: '', amount: 0, type: 'deposit', note: '' });
    } finally {
      setDepositLoading(false);
    }
  }

  async function deleteGoal(goalId: string) {
    const response = await fetch(`/api/savings/goals/${goalId}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to delete goal.');
    }

    await refreshSummary();
    setSelectedGoal(null);
  }

  async function archiveGoal(goalId: string) {
    const response = await fetch(`/api/savings/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });

    if (!response.ok) {
      throw new Error('Failed to archive goal.');
    }

    await refreshSummary();
    setSelectedGoal(null);
  }

  async function saveGoalEdits(goal: SavingsGoalWithDeposits) {
    const response = await fetch(`/api/savings/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: goal.name,
        emoji: goal.emoji,
        colorAccent: goal.colorAccent,
        tag: goal.tag,
        motivationNote: goal.motivationNote,
        targetAmount: goal.targetAmount,
        deadline: goal.deadline,
        isPrivate: goal.isPrivate,
        isPinned: goal.isPinned,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update goal.');
    }

    await refreshSummary();
    setEditMode(false);
  }

  return (
    <>
      <div className="min-h-screen bg-[#f8f7f2] px-4 py-5 sm:px-6 md:py-6">
        <div className="mx-auto max-w-5xl">
          <header className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold text-zinc-900 md:text-3xl">
                Savings goals
              </h1>
              <p className="mt-1 text-sm text-zinc-500">Plan, track, and celebrate every milestone.</p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddGoal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus size={16} /> Add goal
            </button>
          </header>

          <section className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <button
              type="button"
              className="relative w-full rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5 text-left transition-transform duration-100 active:scale-95 md:p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">Total saved</p>
                <Wallet size={16} color="#1D9E75" />
              </div>
              <p className="text-[20px] font-medium leading-tight text-zinc-900">{formatCurrency(summary.totalSaved)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">across active goals</p>
            </button>

            <button
              type="button"
              className="relative w-full rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5 text-left transition-transform duration-100 active:scale-95 md:p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">Active goals</p>
                <Target size={16} color="#185FA5" />
              </div>
              <p className="text-[20px] font-medium leading-tight text-zinc-900">{summary.activeGoalCount}</p>
              <p className="mt-1 text-[11px] text-zinc-500">currently in progress</p>
            </button>

            <button
              type="button"
              onClick={() => setShowSavingsRatePopup(true)}
              className="relative w-full rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5 text-left transition-transform duration-100 active:scale-95 md:p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-zinc-500">Savings rate</p>
                <TrendingUp size={16} color="#3C3489" />
              </div>
              <p className="text-[20px] font-medium leading-tight text-zinc-900">{Math.round(savingsRate)}%</p>
              <p className="mt-1 text-[11px] text-zinc-500">tap for Berde insights</p>
            </button>
          </section>

          <section className="mt-5 space-y-3">
            {activeGoals.length === 0 ? (
              <article className="rounded-2xl border-[0.5px] border-dashed border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-5 text-center">
                <p className="text-sm text-zinc-600">No savings goals yet.</p>
                <button
                  type="button"
                  onClick={() => setShowAddGoal(true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white"
                >
                  <Plus size={14} /> Set your first goal
                </button>
              </article>
            ) : (
              activeGoals.map((goal, index) => (
                <article
                  key={goal.id}
                  className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4 animate-fade-up"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <button type="button" className="w-full text-left" onClick={() => setSelectedGoal(goal)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-zinc-900">
                          {goal.emoji} {goal.name}
                          {goal.isPinned ? <Pin size={14} className="ml-1 inline text-[#1D9E75]" /> : null}
                          {goal.isPrivate ? <Lock size={14} className="ml-1 inline text-zinc-500" /> : null}
                        </p>
                        {goal.tag ? <p className="mt-1 text-xs text-zinc-500">#{goal.tag}</p> : null}
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${badgeStyles(goal.health)}`}>
                        {healthLabel(goal.health)}
                      </span>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full animate-progress-grow"
                        style={{
                          '--progress-target': `${Math.min(100, goal.progressPercent)}%`,
                          backgroundColor: goal.colorAccent,
                        } as CSSProperties}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                      <p>{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</p>
                      <p className="font-medium text-zinc-700">{goal.progressPercent}%</p>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">
                      {goal.deadline ? `Deadline: ${formatDate(goal.deadline)}` : 'No deadline'}
                    </div>
                    {goal.projectedCompletionDate ? (
                      <div className="mt-1 text-xs text-zinc-500">
                        Projected completion: {formatDate(goal.projectedCompletionDate)}
                      </div>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGoalForDeposit(goal);
                      setDepositInput({
                        goalId: goal.id,
                        amount: 0,
                        type: 'deposit',
                        note: '',
                      });
                      setShowAddSavings(true);
                    }}
                    className="mt-3 inline-flex items-center rounded-lg bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Add savings
                  </button>
                </article>
              ))
            )}
          </section>

          <section className="mt-6 rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className="flex w-full items-center justify-between"
            >
              <p className="text-sm font-medium text-zinc-800">Completed / Archived goals</p>
              <Archive size={16} className="text-zinc-500" />
            </button>

            {showArchived ? (
              <div className="mt-3 space-y-2">
                {mutedGoals.length === 0 ? (
                  <p className="text-xs text-zinc-500">No completed or archived goals yet.</p>
                ) : (
                  mutedGoals.map((goal) => (
                    <article key={goal.id} className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600">
                      <p className="font-medium text-zinc-700">{goal.emoji} {goal.name}</p>
                      <p className="text-xs">{goal.status}</p>
                    </article>
                  ))
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {selectedGoal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setSelectedGoal(null)}>
          <div
            className="modal-shell w-full max-w-lg rounded-t-3xl bg-white p-5 animate-slide-up"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">Goal details</h2>
              <button type="button" onClick={() => setSelectedGoal(null)} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-base font-semibold text-zinc-900">{selectedGoal.emoji} {selectedGoal.name}</p>
              {selectedGoal.tag ? <p className="mt-1 text-xs text-zinc-500">#{selectedGoal.tag}</p> : null}
              {selectedGoal.motivationNote ? <p className="mt-2 text-sm text-zinc-700">{selectedGoal.motivationNote}</p> : null}

              <div className="mt-3 h-2 rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full animate-progress-grow"
                  style={{
                    '--progress-target': `${Math.min(100, selectedGoal.progressPercent)}%`,
                    backgroundColor: selectedGoal.colorAccent,
                  } as CSSProperties}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
                <p>{formatCurrency(selectedGoal.currentAmount)} / {formatCurrency(selectedGoal.targetAmount)}</p>
                <p>{selectedGoal.progressPercent}%</p>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {selectedGoal.milestones.map((milestone, index) => (
                  <div
                    key={milestone.percent}
                    className="rounded-lg bg-zinc-50 p-2 text-center animate-fade-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <p className="text-xs font-semibold text-zinc-700">{milestone.percent}%</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{milestone.hitAt ? formatDate(milestone.hitAt) : 'Pending'}</p>
                  </div>
                ))}
              </div>

              {selectedGoal.requiredMonthlyAmount !== undefined ? (
                <p className="mt-3 text-xs text-zinc-600">
                  How much per month: {formatCurrency(selectedGoal.requiredMonthlyAmount)}
                </p>
              ) : null}
              {selectedGoal.projectedCompletionDate ? (
                <p className="mt-1 text-xs text-zinc-600">
                  Projected completion: {formatDate(selectedGoal.projectedCompletionDate)}
                </p>
              ) : null}
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-zinc-800">Deposit log</p>
              <div className="mt-2 space-y-2">
                {[...selectedGoal.deposits]
                  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                  .map((deposit, index) => (
                    <article
                      key={deposit.id}
                      className="rounded-xl border border-zinc-200 p-3 text-xs text-zinc-600 animate-fade-up"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="flex items-center justify-between">
                        <p className={deposit.type === 'deposit' ? 'text-[#1D9E75]' : 'text-[#D85A30]'}>
                          {deposit.type === 'deposit' ? '+' : '-'} {formatCurrency(deposit.amount)}
                        </p>
                        <p>{formatDate(deposit.createdAt)}</p>
                      </div>
                      {deposit.note ? <p className="mt-1 text-zinc-500">{deposit.note}</p> : null}
                    </article>
                  ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditMode((prev) => !prev)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700"
              >
                Edit goal
              </button>
              <button
                type="button"
                onClick={() => void archiveGoal(selectedGoal.id)}
                className="rounded-lg border border-[#EF9F27] px-3 py-2 text-xs font-medium text-[#B66A12]"
              >
                Archive goal
              </button>
              <button
                type="button"
                onClick={() => void deleteGoal(selectedGoal.id)}
                className="rounded-lg border border-[#D85A30] px-3 py-2 text-xs font-medium text-[#D85A30]"
              >
                Delete goal
              </button>
            </div>

            {editMode ? (
              <form
                className="mt-4 space-y-2 rounded-xl border border-zinc-200 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (selectedGoal) {
                    void saveGoalEdits(selectedGoal);
                  }
                }}
              >
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  value={selectedGoal.name}
                  onChange={(event) => setSelectedGoal({ ...selectedGoal, name: event.target.value })}
                  placeholder="Goal name"
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  type="number"
                  min={1}
                  value={selectedGoal.targetAmount}
                  onChange={(event) =>
                    setSelectedGoal({ ...selectedGoal, targetAmount: Number(event.target.value || 0) })
                  }
                  placeholder="Target amount"
                />
                <input
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  type="month"
                  value={toMonthInputValue(selectedGoal.deadline)}
                  onChange={(event) =>
                    setSelectedGoal({
                      ...selectedGoal,
                      deadline: event.target.value ? `${event.target.value}-01` : undefined,
                    })
                  }
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#1D9E75] px-3 py-2 text-sm font-semibold text-white"
                >
                  Save edits
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {showAddGoal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowAddGoal(false)}>
          <div
            className="modal-shell w-full max-w-lg rounded-t-3xl bg-white p-5 animate-slide-up"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">New savings goal</h2>
              <button type="button" onClick={() => setShowAddGoal(false)} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>

            <form className="space-y-3" onSubmit={submitNewGoal}>
              <input
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Goal name"
                value={goalInput.name}
                onChange={(event) => setGoalInput((prev) => ({ ...prev, name: event.target.value }))}
                required
              />

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.05em] text-zinc-500">Emoji</p>
                <div className="grid grid-cols-5 gap-2">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setGoalInput((prev) => ({ ...prev, emoji }))}
                      className={`rounded-lg border px-2 py-2 text-lg ${goalInput.emoji === emoji ? 'border-[#1D9E75] bg-[#E1F5EE]' : 'border-zinc-300'}`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEmojiCustom((prev) => !prev)}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-lg"
                  >
                    +
                  </button>
                </div>
                {emojiCustom ? (
                  <input
                    className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    inputMode="text"
                    maxLength={2}
                    value={goalInput.emoji}
                    onChange={(event) =>
                      setGoalInput((prev) => ({ ...prev, emoji: event.target.value || '🎯' }))
                    }
                  />
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.05em] text-zinc-500">Color accent</p>
                <div className="flex flex-wrap gap-2">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setGoalInput((prev) => ({ ...prev, colorAccent: color }))}
                      className={`h-7 w-7 rounded-full border-2 ${goalInput.colorAccent === color ? 'border-zinc-800' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <input
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Tag (optional)"
                value={goalInput.tag}
                onChange={(event) => setGoalInput((prev) => ({ ...prev, tag: event.target.value }))}
              />
              <textarea
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Motivation note (optional)"
                value={goalInput.motivationNote}
                onChange={(event) => setGoalInput((prev) => ({ ...prev, motivationNote: event.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                type="number"
                min={1}
                placeholder="Target amount"
                value={goalInput.targetAmount || ''}
                onChange={(event) => setGoalInput((prev) => ({ ...prev, targetAmount: Number(event.target.value || 0) }))}
                required
              />
              <input
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                type="month"
                value={toMonthInputValue(goalInput.deadline)}
                onChange={(event) => setGoalInput((prev) => ({ ...prev, deadline: event.target.value }))}
              />

              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={Boolean(goalInput.isPrivate)}
                  onChange={(event) => setGoalInput((prev) => ({ ...prev, isPrivate: event.target.checked }))}
                />
                Private goal
              </label>

              <button
                type="submit"
                disabled={goalLoading}
                className="w-full rounded-xl bg-[#1D9E75] px-3 py-3 text-sm font-semibold text-white disabled:opacity-70"
              >
                {goalLoading ? 'Saving...' : 'Create goal'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showAddSavings && goalForDeposit ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade-in" onClick={() => setShowAddSavings(false)}>
          <div
            className="modal-shell w-full max-w-md rounded-t-3xl bg-white p-5 animate-slide-up"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Add savings</h2>
                <p className="text-xs text-zinc-500">{goalForDeposit.emoji} {goalForDeposit.name}</p>
              </div>
              <button type="button" onClick={() => setShowAddSavings(false)} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100">
                <X size={18} />
              </button>
            </div>

            <form className="space-y-3" onSubmit={submitDeposit}>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setDepositInput((prev) => ({ ...prev, amount }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-700"
                  >
                    {formatCurrency(amount)}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                value={depositInput.amount || ''}
                onChange={(event) =>
                  setDepositInput((prev) => ({ ...prev, amount: Number(event.target.value || 0) }))
                }
                placeholder="Amount"
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDepositInput((prev) => ({ ...prev, type: 'deposit' }))}
                  className={`rounded-lg border px-3 py-2 text-sm ${depositInput.type === 'deposit' ? 'border-[#1D9E75] bg-[#E1F5EE] text-[#1D9E75]' : 'border-zinc-300 text-zinc-600'}`}
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setDepositInput((prev) => ({ ...prev, type: 'withdrawal' }))}
                  className={`rounded-lg border px-3 py-2 text-sm ${depositInput.type === 'withdrawal' ? 'border-[#D85A30] bg-[#FDECEC] text-[#D85A30]' : 'border-zinc-300 text-zinc-600'}`}
                >
                  Withdrawal
                </button>
              </div>

              <input
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Note (optional)"
                value={depositInput.note}
                onChange={(event) => setDepositInput((prev) => ({ ...prev, note: event.target.value }))}
              />

              <button
                type="submit"
                disabled={depositLoading}
                className="w-full rounded-xl bg-[#1D9E75] px-3 py-3 text-sm font-semibold text-white disabled:opacity-70"
              >
                {depositLoading ? 'Saving...' : 'Save entry'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <SavingsRatePopup
        open={showSavingsRatePopup}
        onClose={() => setShowSavingsRatePopup(false)}
        savingsRate={savingsRate}
        firstName="friend"
      />
    </>
  );
}
