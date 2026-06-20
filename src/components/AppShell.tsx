import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { MessageSquare, Settings, Shield, LogOut, Users, Hash, User as UserIcon } from "lucide-react";
import { Logo } from "./Logo";
import { useProfile, useIsAdmin } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";

export function AppShell({ children, leftPanel }: { children: React.ReactNode; leftPanel?: React.ReactNode }) {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() || "U";

  const navItems = [
    { to: "/app", icon: MessageSquare, label: "Чаты", active: pathname.startsWith("/app") },
    { to: "/settings", icon: Settings, label: "Настройки", active: pathname.startsWith("/settings") },
    ...(isAdmin ? [{ to: "/admin", icon: Shield, label: "Админ", active: pathname.startsWith("/admin") }] : []),
  ];

  return (
    <div className="min-h-screen flex">
      {/* Rail */}
      <aside className="w-[72px] glass-strong border-r border-border/40 flex flex-col items-center py-4 gap-2">
        <Link to="/app" className="mb-2"><Logo size={40} /></Link>
        <div className="flex-1 flex flex-col gap-1.5 mt-2">
          {navItems.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              title={it.label}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
                it.active ? "bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white neon-glow" : "hover:bg-white/5 text-muted-foreground"
              }`}
            >
              <it.icon className="h-5 w-5" />
            </Link>
          ))}
        </div>
        <Link to="/settings" className="mt-2">
          <Avatar className="h-11 w-11 ring-2 ring-[var(--neon-violet)]/60">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white font-bold">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <button onClick={signOut} title="Выйти" className="mt-2 w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition">
          <LogOut className="h-5 w-5" />
        </button>
      </aside>

      {leftPanel && (
        <aside className="w-[320px] border-r border-border/40 flex flex-col">{leftPanel}</aside>
      )}

      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

export const folderIcons = { all: MessageSquare, direct: UserIcon, group: Users, channel: Hash };
