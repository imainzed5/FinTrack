export interface LoginPayload {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

export interface PasswordRuleChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export interface PasswordStrengthResult {
  checks: PasswordRuleChecks;
  score: number;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Excellent';
}

export type AuthField =
  | 'fullName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'acceptedTerms';

export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export interface AuthSuccessResponse {
  success: true;
  message: string;
  redirectTo?: string;
  requiresEmailVerification?: boolean;
}

export interface AuthErrorResponse {
  success: false;
  error: string;
  fieldErrors?: AuthFieldErrors;
}

export type AuthApiResponse = AuthSuccessResponse | AuthErrorResponse;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  rememberMe: boolean;
  user: SessionUser | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const UPPERCASE_PATTERN = /[A-Z]/;
const LOWERCASE_PATTERN = /[a-z]/;
const NUMBER_PATTERN = /[0-9]/;
const SYMBOL_PATTERN = /[^A-Za-z0-9]/;

export const PASSWORD_RULES: ReadonlyArray<{
  id: keyof PasswordRuleChecks;
  label: string;
}> = [
  { id: 'minLength', label: 'At least 8 characters' },
  { id: 'hasUppercase', label: 'One uppercase letter' },
  { id: 'hasLowercase', label: 'One lowercase letter' },
  { id: 'hasNumber', label: 'One number' },
  { id: 'hasSymbol', label: 'One symbol' },
];

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmailAddress(email));
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks: PasswordRuleChecks = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: UPPERCASE_PATTERN.test(password),
    hasLowercase: LOWERCASE_PATTERN.test(password),
    hasNumber: NUMBER_PATTERN.test(password),
    hasSymbol: SYMBOL_PATTERN.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  if (score === 0) {
    return { checks, score, label: 'Very weak' };
  }
  if (score === 1) {
    return { checks, score, label: 'Weak' };
  }
  if (score === 2) {
    return { checks, score, label: 'Fair' };
  }
  if (score === 3) {
    return { checks, score, label: 'Good' };
  }
  if (score === 4) {
    return { checks, score, label: 'Strong' };
  }

  return { checks, score, label: 'Excellent' };
}

export function validateLoginPayload(payload: LoginPayload): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (!payload.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!isValidEmailAddress(payload.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!payload.password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function validateSignupPayload(payload: SignupPayload): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (!payload.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  } else if (payload.fullName.trim().length < 2) {
    errors.fullName = 'Full name should be at least 2 characters.';
  }

  if (!payload.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!isValidEmailAddress(payload.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!payload.password) {
    errors.password = 'Password is required.';
  } else {
    const strength = evaluatePasswordStrength(payload.password);
    if (strength.score < PASSWORD_RULES.length) {
      errors.password = 'Password must satisfy all listed rules.';
    }
  }

  if (!payload.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (payload.confirmPassword !== payload.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (!payload.acceptedTerms) {
    errors.acceptedTerms = 'You need to accept the terms to continue.';
  }

  return errors;
}
