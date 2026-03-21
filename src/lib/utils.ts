export function formatCurrency(amount: number): string {
  return `₱${Math.abs(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const APP_TIME_ZONE = 'Asia/Manila';

export function getTodayDateKeyInManila(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_TIME_ZONE });
}

export function getTodayWeekdayShortInManila(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: APP_TIME_ZONE,
  }).format(new Date());
}
