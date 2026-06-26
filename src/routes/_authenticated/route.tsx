import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wait briefly for Supabase to hydrate the session from storage or from the
 * OAuth/OTP redirect URL. Avoids a "gray screen" right after sign-in where
 * `getUser()` is called before `detectSessionInUrl` has stored the token.
 */
async function waitForSession(timeoutMs = 2500) {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;

  return new Promise<typeof data.session>((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) {
        sub.subscription.unsubscribe();
        resolve(session);
      }
    });
    setTimeout(() => {
      sub.subscription.unsubscribe();
      resolve(null);
    }, timeoutMs);
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await waitForSession();
    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } as never });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});
