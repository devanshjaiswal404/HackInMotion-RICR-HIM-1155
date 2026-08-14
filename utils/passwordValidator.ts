export type PasswordStrength = "weak" | "medium" | "strong";

export interface PasswordCheck {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export interface PasswordResult {
  checks: PasswordCheck;
  score: number; // 0-5
  strength: PasswordStrength;
  isValid: boolean;
}

export const WEAK_PASSWORD_MESSAGE =
  "⚠️ This password is too weak. Please use at least 8 characters with numbers and symbols.";

export function validatePassword(password: string): PasswordResult {
  const checks: PasswordCheck = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;

  // Minimum security threshold: length + number + special (+ letters)
  const isValid =
    checks.minLength &&
    checks.hasNumber &&
    checks.hasSpecial &&
    checks.hasUppercase &&
    checks.hasLowercase;

  const strength: PasswordStrength = isValid ? "strong" : score >= 3 ? "medium" : "weak";

  return { checks, score, strength, isValid };
}
