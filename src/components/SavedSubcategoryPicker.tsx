'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Category } from '@/lib/types';

const NEW_OPTION = '__new_subcategory__';

export default function SavedSubcategoryPicker({
  category,
  value,
  options,
  disabled = false,
  compact = false,
  placeholder = 'No subcategory',
  onChange,
  onCreateOption,
}: {
  category: Category;
  value: string;
  options: string[];
  disabled?: boolean;
  compact?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onCreateOption: (category: Category, label: string) => Promise<void>;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const selectClass = compact
    ? 'h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-700 outline-none focus:border-[#1D9E75] sm:h-7 sm:px-2 sm:text-[11px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
    : 'h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-700 outline-none focus:border-[#1D9E75] sm:h-8 sm:px-2.5 sm:text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';

  const normalizedOptions = useMemo(() => {
    const deduped = Array.from(new Set(options.filter(Boolean)));
    if (value && !deduped.includes(value)) {
      deduped.unshift(value);
    }
    return deduped;
  }, [options, value]);

  useEffect(() => {
    setIsCreating(false);
    setDraft('');
  }, [category]);

  const handleSelectChange = (nextValue: string) => {
    if (nextValue === NEW_OPTION) {
      setIsCreating(true);
      setDraft('');
      return;
    }

    setIsCreating(false);
    onChange(nextValue);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    setSaving(true);
    try {
      await onCreateOption(category, trimmed);
      onChange(trimmed);
      setDraft('');
      setIsCreating(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={isCreating ? NEW_OPTION : value}
        onChange={(event) => handleSelectChange(event.target.value)}
        disabled={disabled || saving}
        className={`${selectClass} ${disabled ? 'opacity-60' : ''}`}
      >
        <option value="">{placeholder}</option>
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={NEW_OPTION}>+ Add new subcategory</option>
      </select>

      {isCreating ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Add subcategory for ${category}`}
            className={`${selectClass} flex-1`}
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !draft.trim()}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#1D9E75] px-4 text-xs font-medium text-white transition-colors hover:bg-[#187f5d] disabled:cursor-not-allowed disabled:bg-[#7bc2ac]"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setIsCreating(false);
            }}
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-200 px-4 text-xs font-medium text-zinc-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
