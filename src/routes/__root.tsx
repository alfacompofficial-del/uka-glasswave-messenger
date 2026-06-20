import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "../integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

/** Syncs <html lang="..."> with the signed-in user's profile language */
function LangSync() {
  const { data: session } = useQuery({
    queryKey: ["session-for-lang"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    staleTime: 60_000,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-lang", session?.user?.id],
    enabled: !!session?.user,
    queryFn: async () => {
      if (!session?.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", session.user.id)
        .maybeSingle();
      return data;
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const lang = profile?.language;
    if (lang) {
      document.documentElement.lang = lang;
    }
  }, [profile?.language]);

  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-10 text-center max-w-md">
        <h1 className="text-7xl font-bold neon-text">404</h1>
        <p className="mt-4 text-muted-foreground">Страница не найдена</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-primary px-5 py-2 text-primary-foreground hover:opacity-90 transition"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-10 text-center max-w-md">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">Попробуйте обновить страницу.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-lg bg-primary px-5 py-2 text-primary-foreground"
          >
            Попробовать снова
          </button>
          <a href="/" className="rounded-lg border border-border px-5 py-2">
            На главную
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "UKA Messenger — Cyberpunk-стиль, AI-перевод, безграничное общение" },
      {
        name: "description",
        content:
          "UKA Messenger — защищённый мессенджер с киберпанк-эстетикой, AI-переводом сообщений и умным конвертером текста.",
      },
      {
        property: "og:title",
        content: "UKA Messenger — Cyberpunk-стиль, AI-перевод, безграничное общение",
      },
      {
        property: "og:description",
        content:
          "UKA Messenger — защищённый мессенджер с киберпанк-эстетикой, AI-переводом сообщений и умным конвертером текста.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "UKA Messenger — Cyberpunk-стиль, AI-перевод, безграничное общение",
      },
      {
        name: "twitter:description",
        content:
          "UKA Messenger — защищённый мессенджер с киберпанк-эстетикой, AI-переводом сообщений и умным конвертером текста.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@600;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <LangSync />
      <Outlet />
      <Toaster theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}
