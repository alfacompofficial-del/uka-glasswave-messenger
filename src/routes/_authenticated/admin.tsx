import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Shield, ShieldOff, Hash, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/app" });
  },
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const adminIds = new Set(
        (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
      );
      return (data ?? []).map((u) => ({ ...u, is_admin: adminIds.has(u.id) }));
    },
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .in("type", ["group", "channel"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function toggleAdmin(userId: string, currently: boolean) {
    if (currently) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Права админа сняты");
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Права админа выданы");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="h-7 w-7 text-[var(--neon-cyan)]" />
                Админ-панель
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Личные переписки пользователей защищены и недоступны администраторам.
              </p>
            </div>
            <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">
              ← К чатам
            </Link>
          </header>

          <section className="glass-strong rounded-2xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <UsersIcon className="h-5 w-5" /> Пользователи ({users.length})
            </h2>
            <div className="divide-y divide-border/40">
              {users.map((u) => {
                const initials =
                  `${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.toUpperCase() || "?";
                return (
                  <div key={u.id} className="flex items-center gap-3 py-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-[var(--neon-blue)] to-[var(--neon-cyan)] text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {u.first_name} {u.last_name}{" "}
                        {u.is_admin && (
                          <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-[var(--neon-violet)]/20 text-[var(--neon-violet)] uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        @{u.username ?? "—"} · {u.email ?? ""} · {u.phone ?? ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={u.is_admin ? "destructive" : "outline"}
                      onClick={() => toggleAdmin(u.id, u.is_admin)}
                    >
                      {u.is_admin ? (
                        <>
                          <ShieldOff className="h-4 w-4 mr-1" /> Снять
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-1" /> Назначить
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-strong rounded-2xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Hash className="h-5 w-5" /> Группы и каналы ({rooms.length})
            </h2>
            {rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет групп и каналов.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {rooms.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.name ?? "Без названия"}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {r.type} · создан {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="glass rounded-xl p-4 text-xs text-muted-foreground border border-[var(--neon-cyan)]/30">
            🔒 <strong>Приватность:</strong> сообщения личных чатов недоступны администратору на
            уровне базы данных (RLS).
          </div>
        </div>
      </div>
    </AppShell>
  );
}
