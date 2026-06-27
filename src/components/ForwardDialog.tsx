import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Forward } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  content: string;
  excludeConversationId?: string;
};

type Row = {
  conversation_id: string;
  title: string;
  avatar: string | null;
  type: string;
};

export function ForwardDialog({ open, onOpenChange, content, excludeConversationId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("conversation_id, conversations(id, type, name, avatar_url)")
        .eq("user_id", user.id);
      const list: Row[] = [];
      for (const m of (members ?? []) as any[]) {
        const c = m.conversations;
        if (!c) continue;
        if (c.id === excludeConversationId) continue;
        let title = c.name ?? "Чат";
        let avatar: string | null = c.avatar_url ?? null;
        if (c.type === "direct") {
          const { data: other } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", c.id)
            .neq("user_id", user.id)
            .maybeSingle();
          if (other?.user_id) {
            const { data: p } = await supabase
              .from("profiles")
              .select("first_name, last_name, avatar_url, username")
              .eq("id", other.user_id)
              .maybeSingle();
            if (p) {
              title = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `@${p.username ?? "user"}`;
              avatar = p.avatar_url;
            }
          }
        }
        list.push({ conversation_id: c.id, title, avatar, type: c.type });
      }
      setRows(list);
    })();
  }, [open, user, excludeConversationId]);

  async function forwardTo(convId: string) {
    if (!user) return;
    setSending(convId);
    const fwd = `[Переслано]\n${content}`;
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: user.id, content: fwd });
    setSending(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Переслано");
    onOpenChange(false);
  }

  const filtered = rows.filter((r) => r.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-5 w-5" /> Переслать
          </DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Поиск чата…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {filtered.map((r) => {
            const initials =
              r.title.split(" ").map((s) => s[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
            return (
              <button
                key={r.conversation_id}
                onClick={() => forwardTo(r.conversation_id)}
                disabled={sending === r.conversation_id}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition text-left"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={r.avatar ?? undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.type === "direct" ? "Личный чат" : r.type === "group" ? "Группа" : "Канал"}
                  </div>
                </div>
                {sending === r.conversation_id && (
                  <span className="text-xs text-muted-foreground">…</span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">Чатов не найдено</div>
          )}
        </div>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Отмена
        </Button>
      </DialogContent>
    </Dialog>
  );
}
