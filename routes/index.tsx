import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FinSight AI — Expense & Financial Health Tracker" },
      {
        name: "description",
        content:
          "FinSight AI is a private finance tracker: log transactions, set category budgets and watch your financial health score improve.",
      },
      {
        property: "og:title",
        content: "FinSight AI — Expense & Financial Health Tracker",
      },
      {
        property: "og:description",
        content: "FinSight AI is a private finance tracker: log transactions, set category budgets and watch your financial health score improve.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sightfinai.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://sightfinai.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "FinSight AI",
              url: "https://sightfinai.lovable.app/",
              logo: "https://sightfinai.lovable.app/favicon.ico",
            },
            {
              "@type": "WebSite",
              name: "FinSight AI",
              url: "https://sightfinai.lovable.app/",
              description:
                "Private finance tracker for transactions, category budgets and a financial health score.",
            },
          ],
        }),
      },
    ],
  }),

  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center px-5">
        <span className="font-display text-lg font-semibold tracking-tight">FinSight AI</span>
        <div className="ml-auto">
          {signedIn ? (
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go to dashboard
            </button>
          ) : (
            <Link
              to="/auth"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight">
          Know exactly where your money goes.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          FinSight AI keeps your transactions, budgets and financial health score in one private
          workspace — visible only to you.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <Link
            to={signedIn ? "/dashboard" : "/auth"}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {signedIn ? "Open dashboard" : "Get started free"}
          </Link>
        </div>

        <div className="mt-20 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["Transactions", "Log every expense and income with merchant, category and mode."],
            ["Budget Rules", "Set a monthly limit per category and stay ahead of overspending."],
            ["Health Insights", "One number that tracks how your finances are trending."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
