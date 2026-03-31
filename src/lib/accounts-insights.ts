import { differenceInCalendarDays, parseISO } from 'date-fns';
import { isOperationalTransaction } from './transaction-classification';
import type { AccountType, AccountWithBalance, Transaction } from './types';
import type { BerdeState } from './berde/berde.types';

export type AccountsInsightTone = 'good' | 'warning' | 'info';

export type AccountsInsightDetail = {
  label: string;
  value: string;
  note: string;
  tone: AccountsInsightTone;
};

export type AccountsInsight = {
  state: BerdeState;
  eyebrow: string;
  title: string;
  message: string;
  dataLine: string;
  badge: string;
  drawerSubtitle: string;
  nextStep: string;
  details: AccountsInsightDetail[];
};

type AccountsInsightVariant = {
  title: string;
  message: string;
  nextStep: string;
  drawerSubtitle?: string;
};

type AccountBehavior = {
  account: AccountWithBalance;
  transactions: Transaction[];
  nonOperationalTransactions: Transaction[];
  incomeTransactions: Transaction[];
  spendingTransactions: Transaction[];
  transferOutTransactions: Transaction[];
  lastMeaningfulActivity: Date | null;
  daysSinceMeaningfulActivity: number | null;
};

export function isWalletType(type: AccountType): boolean {
  return type === 'Cash' || type === 'E-Wallet';
}

export function isBankGroupType(type: AccountType): boolean {
  return type === 'Bank' || type === 'Other';
}

function hashInsightKey(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return hash;
}

function getAccountsInsightSeed(
  activeAccounts: AccountWithBalance[],
  archivedCount: number,
  now: Date,
): number {
  const daySeed = Math.floor(now.getTime() / 86400000);

  return activeAccounts.reduce((seed, account) => {
    const balanceBucket = Math.round(account.computedBalance);
    return seed ^ hashInsightKey(`${account.id}:${account.name}:${account.type}:${balanceBucket}`);
  }, daySeed ^ (archivedCount * 97));
}

function pickInsightVariant<T>(variants: readonly T[], seed: number): T {
  return variants[Math.abs(seed) % variants.length];
}

function buildAccountsInsight(
  base: Omit<AccountsInsight, 'title' | 'message' | 'nextStep'> & { drawerSubtitle: string },
  variants: readonly AccountsInsightVariant[],
  seed: number,
): AccountsInsight {
  const variant = pickInsightVariant(variants, seed);

  return {
    ...base,
    title: variant.title,
    message: variant.message,
    nextStep: variant.nextStep,
    drawerSubtitle: variant.drawerSubtitle ?? base.drawerSubtitle,
  };
}

function getMeaningfulActivityDate(transactions: Transaction[]): Date | null {
  const datedTransactions = transactions
    .map((transaction) => parseISO(transaction.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  return datedTransactions[0] ?? null;
}

function buildAccountBehavior(
  account: AccountWithBalance,
  transactions: Transaction[],
  now: Date,
): AccountBehavior {
  const accountTransactions = transactions.filter((transaction) => transaction.accountId === account.id);
  const nonOperationalTransactions = accountTransactions.filter((transaction) => !isOperationalTransaction(transaction));
  const incomeTransactions = accountTransactions.filter((transaction) => transaction.type === 'income');
  const spendingTransactions = accountTransactions.filter((transaction) => transaction.type === 'expense');
  const transferOutTransactions = accountTransactions.filter(
    (transaction) => Boolean(transaction.transferGroupId) && transaction.type === 'expense'
  );
  const lastMeaningfulActivity = getMeaningfulActivityDate(nonOperationalTransactions);

  return {
    account,
    transactions: accountTransactions,
    nonOperationalTransactions,
    incomeTransactions,
    spendingTransactions,
    transferOutTransactions,
    lastMeaningfulActivity,
    daysSinceMeaningfulActivity: lastMeaningfulActivity
      ? differenceInCalendarDays(now, lastMeaningfulActivity)
      : null,
  };
}

export function getAccountsInsight({
  activeAccounts,
  archivedCount,
  transactions,
  now = new Date(),
}: {
  activeAccounts: AccountWithBalance[];
  archivedCount: number;
  transactions: Transaction[];
  now?: Date;
}): AccountsInsight {
  const seed = getAccountsInsightSeed(activeAccounts, archivedCount, now);

  if (activeAccounts.length === 0) {
    return buildAccountsInsight({
      state: 'helper',
      eyebrow: 'Smart account insight',
      dataLine: 'No active accounts yet',
      badge: 'setup first',
      drawerSubtitle: archivedCount > 0
        ? `${archivedCount} archived account${archivedCount === 1 ? '' : 's'} waiting in the background`
        : 'No active accounts to evaluate yet',
      details: [
        {
          label: 'Active setup',
          value: '0 active accounts',
          note: 'There is no home base for cash flow yet.',
          tone: 'warning',
        },
        {
          label: 'Coverage',
          value: archivedCount > 0 ? `${archivedCount} archived` : 'Nothing archived',
          note: archivedCount > 0 ? 'Old accounts are preserved, but none are active.' : 'No saved account history yet.',
          tone: 'info',
        },
      ],
    }, [
      {
        title: 'Start with one real home for your money.',
        message: 'Add your main cash wallet or bank account first so every transaction lands somewhere intentional.',
        nextStep: 'Add the account you use most often first, then let the other accounts earn their place in the setup.',
      },
      {
        title: 'No active account is holding the system together yet.',
        message: 'Transactions are easier to trust when there is a clear account behind them. Right now the setup still needs that anchor.',
        nextStep: 'Create the account you reach for every week, then build outward only if it solves a real need.',
      },
      {
        title: 'Berde needs one account to watch first.',
        message: 'Without an active wallet or bank account, everything else stays a little too abstract to guide properly.',
        nextStep: 'Pick a primary account and let it become the base layer for your tracking flow.',
      },
    ], seed);
  }

  const walletCount = activeAccounts.filter((account) => isWalletType(account.type)).length;
  const bankCount = activeAccounts.filter((account) => isBankGroupType(account.type)).length;
  const negativeAccounts = activeAccounts.filter((account) => account.computedBalance < -0.01);
  const zeroBalanceAccounts = activeAccounts.filter((account) => Math.abs(account.computedBalance) <= 0.01);
  const fundedAccounts = activeAccounts.filter((account) => account.computedBalance > 0.01);
  const totalFundedBalance = fundedAccounts.reduce((sum, account) => sum + account.computedBalance, 0);
  const largestFundedAccount = fundedAccounts.reduce<AccountWithBalance | null>((largest, account) => {
    if (!largest || account.computedBalance > largest.computedBalance) {
      return account;
    }

    return largest;
  }, null);
  const largestFundedShare = largestFundedAccount && totalFundedBalance > 0
    ? largestFundedAccount.computedBalance / totalFundedBalance
    : 0;

  const behaviors = activeAccounts.map((account) => buildAccountBehavior(account, transactions, now));
  const staleWallet = behaviors.find(
    (behavior) => isWalletType(behavior.account.type)
      && behavior.account.computedBalance > 0.01
      && behavior.daysSinceMeaningfulActivity !== null
      && behavior.daysSinceMeaningfulActivity >= 30
  );
  const passiveIncomeBank = behaviors.find(
    (behavior) => isBankGroupType(behavior.account.type)
      && behavior.incomeTransactions.length >= 2
      && behavior.spendingTransactions.length === 0
      && behavior.transferOutTransactions.length === 0
  );

  const details: AccountsInsightDetail[] = [
    {
      label: 'Active setup',
      value: `${walletCount} wallet${walletCount === 1 ? '' : 's'} / ${bankCount} bank account${bankCount === 1 ? '' : 's'}`,
      note:
        walletCount > 0 && bankCount > 0
          ? 'Daily-use money and storage money are both represented.'
          : bankCount === 0
            ? 'Most of your money is moving through wallets right now.'
            : 'Most of your money is parked in bank-style accounts right now.',
      tone: walletCount > 0 && bankCount > 0 ? 'good' : 'info',
    },
    {
      label: 'Risk check',
      value: negativeAccounts.length > 0 ? `${negativeAccounts[0].name} below zero` : 'No negative balances',
      note:
        negativeAccounts.length > 0
          ? `${negativeAccounts.length} account${negativeAccounts.length === 1 ? '' : 's'} need attention.`
          : 'Nothing is underwater at the moment.',
      tone: negativeAccounts.length > 0 ? 'warning' : 'good',
    },
    {
      label: 'Balance spread',
      value:
        largestFundedAccount && totalFundedBalance > 0
          ? `${Math.round(largestFundedShare * 100)}% in ${largestFundedAccount.name}`
          : 'No funded account yet',
      note:
        largestFundedAccount && totalFundedBalance > 0
          ? largestFundedShare >= 0.75
            ? 'One account is carrying most of the weight.'
            : 'Your balances are not overly concentrated.'
          : 'All active accounts are at zero or below right now.',
      tone:
        largestFundedAccount && totalFundedBalance > 0
          ? largestFundedShare >= 0.75
            ? 'warning'
            : 'good'
          : 'info',
    },
  ];

  if (staleWallet) {
    details.push({
      label: 'Wallet activity',
      value: `${staleWallet.account.name} idle for ${staleWallet.daysSinceMeaningfulActivity} days`,
      note: 'This wallet still holds money but has not seen meaningful activity in a while.',
      tone: staleWallet.daysSinceMeaningfulActivity !== null && staleWallet.daysSinceMeaningfulActivity >= 45 ? 'warning' : 'info',
    });
  }

  if (passiveIncomeBank) {
    details.push({
      label: 'Flow pattern',
      value: `${passiveIncomeBank.account.name} collects income only`,
      note: 'Income lands here, but the account is not directly funding spending or transfers out yet.',
      tone: 'info',
    });
  }

  if (zeroBalanceAccounts.length > 0) {
    details.push({
      label: 'Idle accounts',
      value: `${zeroBalanceAccounts.length} at zero`,
      note:
        zeroBalanceAccounts.length >= 2
          ? 'Some accounts may be ready to archive if they are no longer active.'
          : 'There is one account you may want to review.',
      tone: zeroBalanceAccounts.length >= 2 ? 'info' : 'good',
    });
  }

  if (archivedCount > 0) {
    details.push({
      label: 'Archived',
      value: `${archivedCount} tucked away`,
      note: 'History is preserved without adding noise to the main list.',
      tone: 'info',
    });
  }

  if (negativeAccounts.length > 0) {
    const primaryRisk = negativeAccounts[0];

    return buildAccountsInsight({
      state: 'worried',
      eyebrow: 'Heads up',
      dataLine: `${negativeAccounts.length} account${negativeAccounts.length === 1 ? '' : 's'} below zero`,
      badge: 'needs review',
      drawerSubtitle: `${activeAccounts.length} active account${activeAccounts.length === 1 ? '' : 's'} under watch`,
      details,
    }, [
      {
        title: 'One account is already below zero.',
        message: `${primaryRisk.name} needs a quick review. Check recent transfers or expenses there before the negative balance snowballs.`,
        nextStep: `Reconcile ${primaryRisk.name} first. If the balance is expected, decide whether it needs a transfer, an adjustment, or a cleanup pass.`,
      },
      {
        title: `${primaryRisk.name} is dragging the setup off balance.`,
        message: 'A negative balance makes the rest of the account view harder to trust. Fix the red account before optimizing anything else.',
        nextStep: `Trace the last few movements in ${primaryRisk.name} and decide whether you are correcting an error or covering a real shortfall.`,
      },
      {
        title: 'A balance slipped under the floor.',
        message: `${primaryRisk.name} is in the red right now. Berde would treat that as the first cleanup item before thinking about account structure.`,
        nextStep: 'Confirm the source of the negative balance, then either move funds, log the missing transaction, or archive the account if it is obsolete.',
      },
    ], seed);
  }

  if (passiveIncomeBank) {
    return buildAccountsInsight({
      state: 'motivational',
      eyebrow: 'Smart account insight',
      dataLine: `${passiveIncomeBank.account.name} receives income but never funds spending`,
      badge: 'flow mismatch',
      drawerSubtitle: `${passiveIncomeBank.account.name} looks like an intake account only`,
      details,
    }, [
      {
        title: 'Income is arriving, but not doing any work from here.',
        message: `${passiveIncomeBank.account.name} receives income, yet nothing suggests it is funding spending or transfers outward.`,
        nextStep: 'If this account is meant to be a holding tank, that is fine. If not, decide where money should move next after income lands.',
      },
      {
        title: `${passiveIncomeBank.account.name} behaves like a dead-end for inflow.`,
        message: 'Berde sees income landing here, but no outward movement that connects it to actual spending behavior.',
        nextStep: 'Clarify whether this is a reserve account or an incomplete flow. If it should fund spending, build the handoff more intentionally.',
      },
      {
        title: 'This bank account receives income, then goes quiet.',
        message: 'That can be deliberate, but it can also mean your money flow is stopping halfway through the system.',
        nextStep: 'Choose whether this account is for storage or for distribution. The account pattern should make that obvious.',
      },
    ], seed);
  }

  if (staleWallet) {
    return buildAccountsInsight({
      state: 'neutral',
      eyebrow: 'Smart account insight',
      dataLine: `${staleWallet.account.name} has been idle for ${staleWallet.daysSinceMeaningfulActivity} days`,
      badge: 'stale wallet',
      drawerSubtitle: 'One wallet is holding money without much recent activity',
      details,
    }, [
      {
        title: 'One wallet has gone quiet for a while.',
        message: `${staleWallet.account.name} still holds money, but it has not seen meaningful use in over a month.`,
        nextStep: 'If this wallet is still active, give it a clearer role. If not, consider moving the balance and archiving it.',
      },
      {
        title: `${staleWallet.account.name} looks parked, not active.`,
        message: 'A wallet that holds cash but does not move for weeks usually wants a clearer purpose or a cleaner exit.',
        nextStep: 'Decide whether this is a true reserve wallet or just leftover structure. Then simplify accordingly.',
      },
      {
        title: 'Berde is watching a wallet that has stopped moving.',
        message: `${staleWallet.account.name} has balance, but not much recent life. That is often a sign of setup drift.`,
        nextStep: 'Review the wallet’s job. If the answer is vague, the account probably needs consolidation or archiving.',
      },
    ], seed);
  }

  if (fundedAccounts.length === 0) {
    return buildAccountsInsight({
      state: 'helper',
      eyebrow: 'Smart account insight',
      dataLine: `${activeAccounts.length} active account${activeAccounts.length === 1 ? '' : 's'}, none currently funded`,
      badge: 'quiet setup',
      drawerSubtitle: 'The structure exists, but it is not carrying money right now',
      details,
    }, [
      {
        title: 'The account map exists, but the balances are flat.',
        message: 'Nothing is funded right now, so the setup is hard to evaluate beyond structure alone.',
        nextStep: 'Once money starts moving through these accounts again, review which ones are useful and which ones can stay archived.',
      },
      {
        title: 'Your setup is present, just inactive.',
        message: 'All active accounts are sitting at zero. That usually means the structure is ready, but not yet doing real work.',
        nextStep: 'When an account becomes active again, decide early whether it belongs in daily use, storage, or nowhere at all.',
      },
    ], seed);
  }

  if (activeAccounts.length === 1) {
    const primaryAccount = activeAccounts[0];

    return buildAccountsInsight({
      state: primaryAccount.computedBalance > 0 ? 'neutral' : 'helper',
      eyebrow: 'Smart account insight',
      dataLine: `${primaryAccount.type === 'Cash' ? 'Cash wallet' : primaryAccount.type === 'E-Wallet' ? 'Digital wallet' : primaryAccount.type === 'Bank' ? 'Bank account' : 'Other account'} only`,
      badge: 'one hub',
      drawerSubtitle: `${primaryAccount.name} is currently doing all the work`,
      details,
    }, [
      {
        title: 'One account is carrying the whole system.',
        message: `${primaryAccount.name} is your entire setup right now. That can stay simple and clean, as long as you know it is doing both spending and storage jobs.`,
        nextStep: 'Keep it lean for now, but add a second account only when it creates real separation or makes cash flow easier to manage.',
      },
      {
        title: `${primaryAccount.name} is your single source of truth.`,
        message: 'There is nothing wrong with a one-account setup. The main question is whether it still gives you enough separation between daily use and reserve money.',
        nextStep: 'If this account feels overloaded, the next best addition is usually a simple buffer account, not three new wallets.',
      },
      {
        title: 'This account setup is minimal by design.',
        message: `Everything runs through ${primaryAccount.name}. That keeps the system easy to scan, but also means every job is stacked into one place.`,
        nextStep: 'Only expand if you need clearer roles for spending, holding, or transfers. Otherwise, simple is fine.',
      },
    ], seed);
  }

  if (zeroBalanceAccounts.length >= 2 && activeAccounts.length >= 3) {
    return buildAccountsInsight({
      state: 'helper',
      eyebrow: 'Smart account insight',
      dataLine: `${zeroBalanceAccounts.length} active account${zeroBalanceAccounts.length === 1 ? '' : 's'} currently at zero`,
      badge: 'clean it up',
      drawerSubtitle: `${activeAccounts.length} active account${activeAccounts.length === 1 ? '' : 's'}, ${zeroBalanceAccounts.length} not doing much`,
      details,
    }, [
      {
        title: 'You are carrying a few idle accounts.',
        message: 'If some wallets are no longer part of your weekly routine, archive them so the balances that matter stay easier to scan.',
        nextStep: 'Keep the accounts you actively move money through. Archive the idle ones so your list stays useful at a glance.',
      },
      {
        title: 'Some accounts are just taking up visual space.',
        message: 'Zero-balance accounts are not urgent, but too many of them make the overview noisier than it needs to be.',
        nextStep: 'Treat this like shelf-cleaning. Leave the accounts that still have a job, and tuck the rest away.',
      },
      {
        title: 'The list has drifted a little wider than the workflow.',
        message: 'A few of these accounts are still active on paper but not active in practice. Berde would rather keep the main view tighter.',
        nextStep: 'Archive the accounts that no longer carry money or decisions, then restore them only if they become relevant again.',
      },
    ], seed);
  }

  if (largestFundedAccount && fundedAccounts.length > 1 && largestFundedShare >= 0.75) {
    return buildAccountsInsight({
      state: 'neutral',
      eyebrow: 'Smart account insight',
      dataLine: `${Math.round(largestFundedShare * 100)}% of funded balance sits in one account`,
      badge: 'high concentration',
      drawerSubtitle: `${largestFundedAccount.name} currently anchors the setup`,
      details,
    }, [
      {
        title: 'Most of your cash is parked in one place.',
        message: `${largestFundedAccount.name} is carrying most of the weight. That is simple, but a second buffer account can make transfers and emergencies less awkward.`,
        nextStep: 'Consider which account should hold day-to-day money and which one should act as reserve, then move toward that split intentionally.',
      },
      {
        title: `${largestFundedAccount.name} has become the center of gravity.`,
        message: 'That concentration is not automatically bad, but it does mean the rest of the setup is not reducing much friction yet.',
        nextStep: 'If you want the structure to help more, give one secondary account a clear role instead of letting it sit as decoration.',
      },
      {
        title: 'The setup looks diversified, but the money is not.',
        message: `You have multiple accounts, yet ${largestFundedAccount.name} still holds nearly everything. Berde reads that as one true account plus extras.`,
        nextStep: 'Either simplify toward the real core account or deliberately split the roles so the extra accounts earn their space.',
      },
    ], seed);
  }

  if (walletCount >= 3 && bankCount === 0) {
    return buildAccountsInsight({
      state: 'motivational',
      eyebrow: 'Smart account insight',
      dataLine: `${walletCount} wallet${walletCount === 1 ? '' : 's'} active, no bank account in rotation`,
      badge: 'structure idea',
      drawerSubtitle: 'Wallet-heavy setup detected',
      details,
    }, [
      {
        title: 'You have plenty of access, not much separation.',
        message: 'Everything is sitting in wallets right now. Consider parking part of your reserve in a bank account so spending money and storage money stop mixing.',
        nextStep: 'One storage account is usually enough to separate convenience money from money you do not want to touch casually.',
      },
      {
        title: 'Your setup is optimized for convenience, not distance.',
        message: 'Wallets are great for movement, but they are not always great for restraint. Berde sees a lot of reach and not much separation.',
        nextStep: 'If you want less leakage, move part of the reserve into a place that is slightly harder to tap without thinking.',
      },
      {
        title: 'There are many doors, but they all open into spending money.',
        message: 'A wallet-only setup keeps things fast. It also makes it easier for reserve money to feel casually available all the time.',
        nextStep: 'A single storage account can create just enough friction to protect the money that is not meant for everyday use.',
      },
    ], seed);
  }

  if (bankCount >= 2 && walletCount === 0) {
    return buildAccountsInsight({
      state: 'neutral',
      eyebrow: 'Smart account insight',
      dataLine: `${bankCount} bank account${bankCount === 1 ? '' : 's'} active, no wallet in rotation`,
      badge: 'storage heavy',
      drawerSubtitle: 'Most of the setup is built around holding, not spending',
      details,
    }, [
      {
        title: 'Your setup leans more toward storage than access.',
        message: 'That can be disciplined, but it may also mean daily spending still has no clearly designated lane.',
        nextStep: 'If everyday expenses feel scattered, give one account a clear “spend from here” role and let the others stay protective.',
      },
      {
        title: 'You have separation, but not much daily-use signal.',
        message: 'Multiple bank-style accounts suggest good storage habits, though Berde cannot clearly see which one handles day-to-day flow.',
        nextStep: 'Choose a primary spending account and keep the others focused on holding or buffering.',
      },
    ], seed);
  }

  if (walletCount > 0 && bankCount > 0) {
    return buildAccountsInsight({
      state: 'proud',
      eyebrow: 'Smart account insight',
      dataLine: `${walletCount} wallet${walletCount === 1 ? '' : 's'} and ${bankCount} bank account${bankCount === 1 ? '' : 's'} active`,
      badge: 'good spread',
      drawerSubtitle: 'Daily-use and storage accounts are both active',
      details,
    }, [
      {
        title: 'Your money is split across daily use and storage.',
        message: 'This setup is healthier than keeping everything in one bucket. Keep one account for frictionless spending and let the others hold the line.',
        nextStep: 'You do not need a big change here. Just keep the roles clear so transfers and spending decisions stay simple.',
      },
      {
        title: 'The account structure is doing its job.',
        message: 'Berde likes this mix. You have at least one place for access and at least one place for distance, which makes the system easier to trust.',
        nextStep: 'Protect the clarity. If a new account cannot explain its purpose in one sentence, it probably does not need to be active.',
      },
      {
        title: 'This setup has real separation, not just extra accounts.',
        message: 'Wallets and bank accounts are both active, which usually means the structure is helping rather than just multiplying screens.',
        nextStep: 'Hold onto the simplicity. The best improvement from here is clearer roles, not necessarily more accounts.',
      },
    ], seed);
  }

  if (archivedCount >= 3 && archivedCount > activeAccounts.length) {
    return buildAccountsInsight({
      state: 'neutral',
      eyebrow: 'Smart account insight',
      dataLine: `${archivedCount} archived account${archivedCount === 1 ? '' : 's'} in history`,
      badge: 'history heavy',
      drawerSubtitle: 'You have kept a long trail of old account structure',
      details,
    }, [
      {
        title: 'Your active setup is lean, but your history is wide.',
        message: 'That is not a problem. It just means this page remembers a lot of earlier structure behind the scenes.',
        nextStep: 'Keep archives tucked away unless they are needed again. The main view should stay focused on today’s working accounts.',
      },
      {
        title: 'Berde sees a lot of account history behind this setup.',
        message: 'The current arrangement is manageable, but there is a sizeable trail of old accounts backing it.',
        nextStep: 'That is fine if the archive is intentional. Just resist restoring accounts unless they solve a real present-day problem.',
      },
    ], seed);
  }

  return buildAccountsInsight({
    state: 'neutral',
    eyebrow: 'Smart account insight',
    dataLine: `${activeAccounts.length} active account${activeAccounts.length === 1 ? '' : 's'} tracked`,
    badge: 'stable',
    drawerSubtitle: 'No obvious friction in the current setup',
    details,
  }, [
    {
      title: 'Your account setup looks steady.',
      message: 'Nothing looks messy here right now. Keep the list lean and make sure each account still has a clear job in your system.',
      nextStep: 'If an account does not have a clear purpose anymore, simplify. Otherwise, keep the structure steady and let consistency do the work.',
    },
    {
      title: 'This account structure is quiet in a good way.',
      message: 'No strong warning signal is standing out. Berde reads that as a setup that is mostly doing what it should.',
      nextStep: 'Do not optimize for sport. Keep the structure stable unless a real friction point appears.',
    },
    {
      title: 'No obvious account drama today.',
      message: 'The balances and structure are not throwing off any major warning signs. That is a decent place to be.',
      nextStep: 'Use that calm well. The next improvement should make the system clearer, not just more complex.',
    },
  ], seed);
}
