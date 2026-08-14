import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCIES, useCurrency, type CurrencyCode } from "@/lib/currency";
import { loadDemoPitchState } from "@/lib/demoData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: "📊" },
  { title: "Transactions", url: "/transactions", icon: "💳" },
  { title: "Health Insights", url: "/insights", icon: "🩺" },
  { title: "Budget Rules", url: "/budgets", icon: "🎯" },
];

export function AppNav() {
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { currency, setCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const demoMutation = useMutation({
    mutationFn: loadDemoPitchState,
    onSuccess: ({ inserted, score }) => {
      toast.success(`Loaded ${inserted} demo transactions — health score ${score}`);
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-card/85 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-5 md:flex md:gap-4">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                FinSight AI
              </span>
              <span className="badge-glow hidden shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-700 lg:inline-flex dark:text-emerald-300">
                <span aria-hidden="true">⚡</span>
                Hackathon Prototype v1.0
              </span>
            </div>
            <span className="hidden truncate text-[11px] font-medium leading-none text-muted-foreground sm:block">
              Smart Expense Analyzer & Financial Health Dashboard
            </span>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 overflow-x-auto text-sm md:flex">
          {navItems.map((item) => {
            const active = currentPath === item.url;
            return (
              <Link
                key={item.title}
                to={item.url}
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 transition-colors hover:text-foreground ${
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground"
                }`}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
            <SelectTrigger className="h-9 w-[76px] px-2 sm:w-[112px] sm:px-3" aria-label="Select currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="tabular-nums">{c.symbol}</span> {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ThemeToggle />

          <button
            onClick={() => demoMutation.mutate()}
            disabled={demoMutation.isPending}
            className="rounded-md border border-border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50 md:hidden"
          >
            {demoMutation.isPending ? "…" : "⚡ Demo"}
          </button>

          <span className="hidden text-sm text-muted-foreground lg:inline">{email}</span>

          <button
            onClick={handleSignOut}
            className="hidden rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary md:block"
          >
            Log Out
          </button>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open navigation menu"
                className="rounded-md border border-border p-2 transition-colors hover:bg-secondary md:hidden"
              >
                <Menu className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0">
              <SheetHeader className="border-b border-border px-5 py-4 text-left">
                <SheetTitle className="font-display">FinSight AI</SheetTitle>
                {email && (
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                )}
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-3">
                {navItems.map((item) => {
                  const active = currentPath === item.url;
                  return (
                    <Link
                      key={item.title}
                      to={item.url}
                      onClick={() => setMenuOpen(false)}
                      className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <span className="mr-2" aria-hidden="true">
                        {item.icon}
                      </span>
                      {item.title}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-3">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full rounded-md border border-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  Log Out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
