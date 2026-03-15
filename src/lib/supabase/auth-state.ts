export const REMEMBER_ME_COOKIE_NAME = 'ft_remember_me';
export const REMEMBER_ME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function parseRememberMeCookie(value: string | undefined): boolean {
  return value === '1';
}
