import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { answerQuestion, QUICK_PROMPTS } from "@/lib/finsightAnswers";
import { totalIncome, totalExpenses, type AnalyticsRow } from "@/lib/analytics";
import { useCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = { role: "user" | "assistant"; text: string };

export function FinSightAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hi! I'm FinSight AI. Ask me anything about your spending, subscriptions or health score.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["assistant-transactions"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("transactions")
        .select("id, date, merchant, category, amount, type, payment_mode")
        .order("date", { ascending: true });
      if (error) throw error;
      return (rows ?? []) as AnalyticsRow[];
    },
  });

  const { symbol } = useCurrency();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const rows = data ?? [];
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");

    setBusy(true);
    try {
      const { data: response, error } = await supabase.functions.invoke("chat", {
        body: {
          prompt: q,
          context: {
            currency: symbol,
            totalIncome: totalIncome(rows),
            totalExpenses: totalExpenses(rows),
            recentTransactions: rows.slice(-20).reverse(),
          },
        },
      });

      if (error) throw error;

      const reply =
        typeof response === "string"
          ? response
          : response?.reply ?? response?.text ?? response?.message ?? "";

      if (!reply || typeof reply !== "string") {
        throw new Error("Empty response from chat edge function");
      }

      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (error) {
      console.error("Chat Edge Function Error:", error);
      // Silent fail-safe: never surface raw API errors to the user.
      setMessages((m) => [...m, { role: "assistant", text: answerQuestion(q, rows) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Sparkles className="size-4" aria-hidden />
          Ask FinSight AI
        </button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-label="FinSight AI assistant"
            className="fixed bottom-0 right-0 z-50 flex h-[85vh] w-full max-w-md flex-col border-l border-border bg-card shadow-2xl sm:bottom-4 sm:right-4 sm:h-[600px] sm:rounded-xl sm:border"
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden />
                <p className="font-display text-sm font-semibold">FinSight AI Assistant</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {busy && (
                <div className="w-fit rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                  Thinking…
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(p)}
                  className="rounded-full border border-border px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
              className="flex items-center gap-2 border-t border-border px-4 py-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your money…"
                maxLength={400}
                className="h-9"
              />
              <Button
                type="submit"
                size="icon"
                disabled={busy}
                className="size-9 shrink-0"
                aria-label="Send"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </aside>
        </>
      )}
    </>
  );
}
