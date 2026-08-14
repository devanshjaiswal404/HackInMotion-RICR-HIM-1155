import { validatePassword, WEAK_PASSWORD_MESSAGE } from "@/utils/passwordValidator";

const BAR_COLORS: Record<string, string> = {
  weak: "bg-red-500",
  medium: "bg-amber-500",
  strong: "bg-emerald-500",
};

const LABEL_COLORS: Record<string, string> = {
  weak: "text-red-600 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  strong: "text-emerald-600 dark:text-emerald-400",
};

const LABELS: Record<string, string> = {
  weak: "Weak",
  medium: "Medium",
  strong: "Strong",
};

export function PasswordStrengthMeter({
  password,
  showError = true,
}: {
  password: string;
  showError?: boolean;
}) {
  if (!password) return null;

  const { score, strength, isValid, checks } = validatePassword(password);
  const pct = Math.max(10, Math.round((score / 5) * 100));

  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${BAR_COLORS[strength]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${LABEL_COLORS[strength]}`}>{LABELS[strength]} password</span>
        <span className="text-muted-foreground">
          {checks.minLength ? "8+ chars" : "min 8 chars"} · {checks.hasNumber ? "number ✓" : "number ✗"} ·{" "}
          {checks.hasSpecial ? "symbol ✓" : "symbol ✗"}
        </span>
      </div>
      {showError && !isValid && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {WEAK_PASSWORD_MESSAGE}
        </p>
      )}
    </div>
  );
}
