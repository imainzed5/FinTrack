import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const AUTH_SESSION_COOKIE_NAME = 'ft_app_session_id';

const MAX_USER_AGENT_LENGTH = 500;
const MAX_IP_LENGTH = 120;

export type SessionDeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface UserAuthSessionRow {
  id: string;
  user_id: string;
  session_token: string;
  device_type: SessionDeviceType;
  device_label: string;
  browser: string;
  os: string;
  ip_address: string | null;
  user_agent: string | null;
  signed_in_at: string;
  last_active_at: string;
  ended_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const USER_AUTH_SESSION_SELECT = `
  id,
  user_id,
  session_token,
  device_type,
  device_label,
  browser,
  os,
  ip_address,
  user_agent,
  signed_in_at,
  last_active_at,
  ended_at,
  revoked_at,
  revoked_reason,
  created_at,
  updated_at
`;

interface SessionIdentity {
  deviceType: SessionDeviceType;
  deviceLabel: string;
  browser: string;
  os: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface EnsureTrackedSessionInput {
  supabase: SupabaseClient;
  userId: string;
  headers: Headers;
  sessionToken?: string | null;
}

interface EnsureTrackedSessionResult {
  sessionToken: string;
  shouldSetCookie: boolean;
  currentSessionId: string | null;
  revoked: boolean;
  trackingAvailable: boolean;
}

function sanitizeValue(value: string | null, fallback: string, maxLength: number): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return trimmed.slice(0, maxLength);
}

function detectBrowser(userAgent: string): string {
  if (userAgent.includes('edg/')) return 'Edge';
  if (userAgent.includes('opr/') || userAgent.includes('opera')) return 'Opera';
  if (userAgent.includes('chrome/')) return 'Chrome';
  if (userAgent.includes('safari/')) return 'Safari';
  if (userAgent.includes('firefox/')) return 'Firefox';
  return 'Unknown browser';
}

function detectOs(userAgent: string): string {
  if (userAgent.includes('windows nt')) return 'Windows';
  if (userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ios')) {
    return 'iOS';
  }
  if (userAgent.includes('android')) return 'Android';
  if (userAgent.includes('mac os x') || userAgent.includes('macintosh')) return 'macOS';
  if (userAgent.includes('linux')) return 'Linux';
  return 'Unknown OS';
}

function detectDeviceType(userAgent: string): SessionDeviceType {
  if (userAgent.includes('ipad') || userAgent.includes('tablet')) {
    return 'tablet';
  }

  if (
    userAgent.includes('mobile') ||
    userAgent.includes('iphone') ||
    userAgent.includes('ipod') ||
    userAgent.includes('android')
  ) {
    return 'mobile';
  }

  if (
    userAgent.includes('windows') ||
    userAgent.includes('macintosh') ||
    userAgent.includes('linux')
  ) {
    return 'desktop';
  }

  return 'unknown';
}

function buildDeviceLabel(os: string, deviceType: SessionDeviceType): string {
  if (deviceType === 'mobile') {
    return os === 'iOS' ? 'iPhone / iOS device' : `${os} mobile device`;
  }

  if (deviceType === 'tablet') {
    return `${os} tablet`;
  }

  if (deviceType === 'desktop') {
    return `${os} desktop`;
  }

  return 'Unknown device';
}

function getFirstForwardedIp(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(',')[0]?.trim();
  if (!first) {
    return null;
  }

  return first;
}

function resolveIpAddress(headers: Headers): string | null {
  const forwarded = getFirstForwardedIp(headers.get('x-forwarded-for'));
  const realIp = headers.get('x-real-ip');
  const cloudflareIp = headers.get('cf-connecting-ip');
  const candidate = forwarded || realIp || cloudflareIp;

  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length <= MAX_IP_LENGTH) {
    return trimmed;
  }

  return trimmed.slice(0, MAX_IP_LENGTH);
}

function buildSessionIdentity(headers: Headers): SessionIdentity {
  const rawUserAgent = headers.get('user-agent');
  const normalizedUserAgent = rawUserAgent ? rawUserAgent.toLowerCase() : '';

  const browser = detectBrowser(normalizedUserAgent);
  const os = detectOs(normalizedUserAgent);
  const deviceType = detectDeviceType(normalizedUserAgent);

  return {
    deviceType,
    deviceLabel: buildDeviceLabel(os, deviceType),
    browser,
    os,
    ipAddress: resolveIpAddress(headers),
    userAgent: rawUserAgent
      ? sanitizeValue(rawUserAgent, '', MAX_USER_AGENT_LENGTH)
      : null,
  };
}

function isMissingSessionTrackingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
  };

  if (candidate.code === '42P01') {
    return true;
  }

  if (typeof candidate.message !== 'string') {
    return false;
  }

  const message = candidate.message.toLowerCase();
  return message.includes('user_auth_sessions') && message.includes('does not exist');
}

export function createAuthSessionToken(): string {
  return randomUUID();
}

export function getAuthSessionCookieOptions(rememberMe: boolean): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge?: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(rememberMe ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  };
}

export function getExpiredAuthSessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: 0;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
}

export async function ensureTrackedSession({
  supabase,
  userId,
  headers,
  sessionToken,
}: EnsureTrackedSessionInput): Promise<EnsureTrackedSessionResult> {
  const normalizedToken = sessionToken?.trim();
  const token = normalizedToken && normalizedToken.length > 0
    ? normalizedToken
    : createAuthSessionToken();

  const shouldSetCookie = !normalizedToken;
  const identity = buildSessionIdentity(headers);
  const nowIso = new Date().toISOString();

  const { data: existingSession, error: selectError } = await supabase
    .from('user_auth_sessions')
    .select(USER_AUTH_SESSION_SELECT)
    .eq('user_id', userId)
    .eq('session_token', token)
    .maybeSingle();

  if (selectError) {
    if (isMissingSessionTrackingTableError(selectError)) {
      return {
        sessionToken: token,
        shouldSetCookie,
        currentSessionId: null,
        revoked: false,
        trackingAvailable: false,
      };
    }

    throw new Error(`Failed to load session tracking record: ${selectError.message}`);
  }

  if (existingSession) {
    const existingRow = existingSession as UserAuthSessionRow;

    if (existingRow.ended_at || existingRow.revoked_at) {
      return {
        sessionToken: token,
        shouldSetCookie,
        currentSessionId: existingRow.id,
        revoked: true,
        trackingAvailable: true,
      };
    }

    const { error: updateError } = await supabase
      .from('user_auth_sessions')
      .update({
        device_type: identity.deviceType,
        device_label: identity.deviceLabel,
        browser: identity.browser,
        os: identity.os,
        ip_address: identity.ipAddress,
        user_agent: identity.userAgent,
        last_active_at: nowIso,
      })
      .eq('id', existingRow.id)
      .eq('user_id', userId);

    if (updateError && !isMissingSessionTrackingTableError(updateError)) {
      throw new Error(`Failed to refresh session tracking record: ${updateError.message}`);
    }

    return {
      sessionToken: token,
      shouldSetCookie,
      currentSessionId: existingRow.id,
      revoked: false,
      trackingAvailable: true,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('user_auth_sessions')
    .insert({
      user_id: userId,
      session_token: token,
      device_type: identity.deviceType,
      device_label: identity.deviceLabel,
      browser: identity.browser,
      os: identity.os,
      ip_address: identity.ipAddress,
      user_agent: identity.userAgent,
      signed_in_at: nowIso,
      last_active_at: nowIso,
    })
    .select('id')
    .single();

  if (insertError) {
    if (isMissingSessionTrackingTableError(insertError)) {
      return {
        sessionToken: token,
        shouldSetCookie,
        currentSessionId: null,
        revoked: false,
        trackingAvailable: false,
      };
    }

    throw new Error(`Failed to create session tracking record: ${insertError.message}`);
  }

  return {
    sessionToken: token,
    shouldSetCookie,
    currentSessionId:
      inserted && typeof inserted === 'object' && 'id' in inserted
        ? String((inserted as { id: unknown }).id)
        : null,
    revoked: false,
    trackingAvailable: true,
  };
}

export async function markCurrentTrackedSessionEnded(params: {
  supabase: SupabaseClient;
  userId: string;
  sessionToken?: string | null;
}): Promise<void> {
  const token = params.sessionToken?.trim();
  if (!token) {
    return;
  }

  const nowIso = new Date().toISOString();
  const { error } = await params.supabase
    .from('user_auth_sessions')
    .update({
      ended_at: nowIso,
      last_active_at: nowIso,
      revoked_reason: null,
    })
    .eq('user_id', params.userId)
    .eq('session_token', token)
    .is('ended_at', null)
    .is('revoked_at', null);

  if (error && !isMissingSessionTrackingTableError(error)) {
    throw new Error(`Failed to close session tracking record: ${error.message}`);
  }
}

export async function revokeOtherTrackedSessions(params: {
  supabase: SupabaseClient;
  userId: string;
  currentSessionToken?: string | null;
  reason: string;
}): Promise<number> {
  const nowIso = new Date().toISOString();
  const currentToken = params.currentSessionToken?.trim() ?? '';

  let updateQuery = params.supabase
    .from('user_auth_sessions')
    .update({
      revoked_at: nowIso,
      revoked_reason: sanitizeValue(params.reason, 'manual_revoke', 80),
      last_active_at: nowIso,
    })
    .eq('user_id', params.userId)
    .is('revoked_at', null)
    .is('ended_at', null);

  if (currentToken.length > 0) {
    updateQuery = updateQuery.neq('session_token', currentToken);
  }

  const { data, error } = await updateQuery.select('id');

  if (error) {
    if (isMissingSessionTrackingTableError(error)) {
      return 0;
    }

    throw new Error(`Failed to revoke other sessions: ${error.message}`);
  }

  return Array.isArray(data) ? data.length : 0;
}
