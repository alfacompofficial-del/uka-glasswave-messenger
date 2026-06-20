import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function NewChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    {
      id: string;
      first_name?: string;
      last_name?: string;
      username?: string;
      phone?: string;
      avatar_url?: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!q.trim() || !user) return;
    setLoading(true);
    const term = q.trim().replace(/^@/, "");
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, username, phone, avatar_url")
      .or(`username.ilike.%${term}%,phone.ilike.%${term}%`)
      .neq("id", user.id)
      .limit(20);
    setResults(data ?? []);
    setLoading(false);
  }

  async function startChat(otherId: string) {
    const { data, error } = await supabase.rpc("get_or_create_direct", { _other: otherId });
    if (error) {
      toast.error(error.message);
      return;
    }
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ to: "/app/$conversationId", params: { conversationId: data as string } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/40 max-w-md">
        <DialogHeader>
          <DialogTitle>Новый чат</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="@username или телефон"
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Найти"}
          </Button>
        </form>
        <div className="max-h-80 overflow-y-auto space-y-1 mt-2">
          {results.map((u) => {
            const initials =
              `${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.toUpperCase() || "?";
            return (
              <button
                key={u.id}
                onClick={() => startChat(u.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition text-left"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {u.first_name} {u.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{u.username ?? "—"} · {u.phone ?? ""}
                  </div>
                </div>
              </button>
            );
          })}
          {!loading && results.length === 0 && q && (
            <div className="text-center text-sm text-muted-foreground py-6">Ничего не найдено</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
