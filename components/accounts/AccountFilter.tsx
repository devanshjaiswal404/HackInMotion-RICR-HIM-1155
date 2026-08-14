import { ACCOUNT_FILTER_OPTIONS, ACCOUNT_STYLES, type AccountName } from "@/lib/accounts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet } from "lucide-react";

export function AccountFilter({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Wallet className="size-4 text-muted-foreground" aria-hidden />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full sm:w-52" aria-label="Filter by account">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACCOUNT_FILTER_OPTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AccountBadge({ account }: { account: AccountName }) {
  const style = ACCOUNT_STYLES[account];
  return (
    <span
      title={account}
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}
    >
      {style.short}
    </span>
  );
}
