import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ChatList } from "@/components/ChatList";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("profiles").select("onboarded").eq("id", u.user.id).maybeSingle();
    if (!data?.onboarded) throw redirect({ to: "/onboarding" });
  },
  component: () => (
    <AppShell leftPanel={<ChatList />}>
      <Outlet />
    </AppShell>
  ),
});
