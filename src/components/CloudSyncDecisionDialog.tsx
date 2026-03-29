'use client';

import { Cloud, HardDrive, Loader2 } from 'lucide-react';

interface CloudSyncDecisionDialogProps {
  open: boolean;
  loading: boolean;
  onKeepDeviceData: () => void;
  onUseCloudBackup: () => void;
}

export default function CloudSyncDecisionDialog({
  open,
  loading,
  onKeepDeviceData,
  onUseCloudBackup,
}: CloudSyncDecisionDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-sync-choice-title"
      aria-describedby="cloud-sync-choice-description"
    >
      <div className="w-full max-w-2xl rounded-[32px] border border-[#d9d4c8] bg-[#f8f3ea] p-6 shadow-[0_24px_70px_rgba(23,20,13,0.28)] sm:p-7">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
          Required choice
        </div>
        <h2
          id="cloud-sync-choice-title"
          className="mt-4 font-display text-3xl font-semibold text-zinc-900"
        >
          Choose which dataset Moneda should keep
        </h2>
        <p
          id="cloud-sync-choice-description"
          className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600"
        >
          This device already has local data, and this account already has a cloud backup.
          Moneda will not merge them automatically. Pick one source before continuing.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={onKeepDeviceData}
            disabled={loading}
            className="rounded-[28px] border border-emerald-200 bg-white/90 p-5 text-left transition-colors hover:bg-emerald-50 disabled:opacity-60"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <HardDrive size={18} />
            </span>
            <p className="mt-4 text-lg font-semibold text-zinc-900">Keep this device data</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Upload what is on this device now and replace the current cloud backup for this account.
            </p>
          </button>

          <button
            type="button"
            onClick={onUseCloudBackup}
            disabled={loading}
            className="rounded-[28px] border border-sky-200 bg-white/90 p-5 text-left transition-colors hover:bg-sky-50 disabled:opacity-60"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Cloud size={18} />
            </span>
            <p className="mt-4 text-lg font-semibold text-zinc-900">Use cloud backup</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Replace what is stored on this device with the data already backed up to your account.
            </p>
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
          No merge path exists in this version. The choice above is a full replace operation.
        </div>

        {loading ? (
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-600">
            <Loader2 size={16} className="animate-spin" />
            Updating your device session...
          </div>
        ) : null}
      </div>
    </div>
  );
}