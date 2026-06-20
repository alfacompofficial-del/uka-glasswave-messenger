import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, CheckCheck, Check } from "lucide-react";
import { NewChatDialog } from "./NewChatDialog";

const FOLDERS = [
  { key: "all", label: "Все" },
  { key: "direct", label: "Личные" },
  { key: "group", label: "Группы" },
  { key: "channel", label: "Каналы" },
] as const;

type Folder = (typeof FOLDERS)[number]["key"];

export function ChatList() {
  const { user } = useAuth();
  const [folder, setFolder] = useState<Folder>("all");
  const [search, setSearch] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const params = useParams({ strict: false }) as { conversationId?: string };

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!user) return [];
      const { data: members } = await supabase
        .from("conversation_members")
        .select("conversation_id, conversations(id, type, name, avatar_url, updated_at)")
        .eq("user_id", user.id);
      const convs = (members ?? []).map((m: unknown) => m.conversations).filter(Boolean);

      // Fetch other-party for direct chats
      const directIds = convs.filter((c: unknown) => c.type === "direct").map((c: unknown) => c.id);
      const otherById: Record<
        string,
        { name: string; avatar?: string | null; firstName?: string; lastName?: string }
      > = {};
      if (directIds.length) {
        const { data: rows } = await supabase
          .from("conversation_members")
          .select(
            "conversation_id, user_id, profiles:profiles!inner(first_name, last_name, avatar_url, username)",
          )
          .in("conversation_id", directIds)
          .neq("user_id", user.id);
        (rows ?? []).forEach((r: unknown) => {
          const fn = r.profiles.first_name || "";
          const ln = r.profiles.last_name || "";
          otherById[r.conversation_id] = {
            name: `${fn} ${ln}`.trim() || `@${r.profiles.username ?? "user"}`,
            avatar: r.profiles.avatar_url,
            firstName: fn,
            lastName: ln,
          };
        });
      }

      // Fetch last message for each conversation
      const convIds = convs.map((c: unknown) => c.id);
      const lastMsgById: Record<
        string,
        { content: string; sender_id: string; created_at: string; is_read: boolean }
      > = {};

      if (convIds.length) {
        for (const cid of convIds) {
          const { data: msgs } = await supabase
            .from("messages")
            .select("id, content, sender_id, created_at")
            .eq("conversation_id", cid)
            .order("created_at", { ascending: false })
            .limit(1);
          if (msgs && msgs.length > 0) {
            const msg = msgs[0];
            lastMsgById[cid] = {
              content: msg.content,
              sender_id: msg.sender_id,
              created_at: msg.created_at,
              is_read: msg.sender_id === user.id,
            };
          }
        }
      }

      return convs
        .map((c: unknown) => {
          const other = otherById[c.id];
          const lastMsg = lastMsgById[c.id];
          const displayName =
            c.type === "direct" ? (other?.name ?? "Чат") : (c.name ?? "Без имени");

          return {
            ...c,
            display_name: displayName,
            display_first_name: c.type === "direct" ? other?.firstName || "" : "",
            display_last_name: c.type === "direct" ? other?.lastName || "" : "",
            display_avatar: c.type === "direct" ? other?.avatar : c.avatar_url,
            last_message: lastMsg?.content ?? null,
            last_message_sender: lastMsg?.sender_id ?? null,
            last_message_time: lastMsg?.created_at ?? c.updated_at,
            last_message_read: lastMsg?.is_read ?? true,
          };
        })
        .sort((a: unknown, b: unknown) => {
          const at = new Date(a.last_message_time || a.updated_at || 0).getTime();
          const bt = new Date(b.last_message_time || b.updated_at || 0).getTime();
          return bt - at;
        });
    },
  });

  const filtered = useMemo(() => {
    let list = conversations;
    if (folder !== "all") list = list.filter((c: unknown) => c.type === folder);
    if (search)
      list = list.filter((c: unknown) =>
        c.display_name.toLowerCase().includes(search.toLowerCase()),
      );
    return list;
  }, [conversations, folder, search]);

  function formatTime(dateStr: string | null) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Вчера";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  }

  function truncate(str: string, max = 34) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max) + "…" : str;
  }

  return (
    <>
      <div className="p-4 border-b border-border/40">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Чаты</h2>
          <button
            onClick={() => setNewChatOpen(true)}
            className="h-9 w-9 rounded-lg bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] flex items-center justify-center text-white hover:scale-105 transition"
            title="Новый чат"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск чатов"
            className="pl-9 h-10"
          />
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto">
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFolder(f.key as Folder)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                folder === f.key
                  ? "bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white neon-glow"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Нет чатов. Начните новый!
          </div>
        ) : (
          filtered.map((c: unknown) => {
            const active = params.conversationId === c.id;
            const initials = (c.display_name as string)
              .split(" ")
              .map((s: string) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const isMine = c.last_message_sender === user?.id;
            const hasUnread = !c.last_message_read && !isMine;

            // For direct chats: "Фамилия Имя" format at top
            const displayTitle =
              c.type === "direct" && (c.display_last_name || c.display_first_name)
                ? `${c.display_last_name} ${c.display_first_name}`.trim()
                : c.display_name;

            return (
              <Link
                key={c.id}
                to="/app/$conversationId"
                params={{ conversationId: c.id }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition border-l-2 cursor-pointer select-none ${
                  active ? "bg-white/8 border-[var(--neon-violet)]" : "border-transparent"
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={c.display_avatar ?? undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-[var(--neon-blue)] to-[var(--neon-cyan)] text-white font-semibold text-sm">
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: name + time */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-semibold truncate text-[13px] leading-tight ${hasUnread ? "text-foreground" : "text-foreground/90"}`}
                    >
                      {displayTitle}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(c.last_message_time)}
                    </span>
                  </div>

                  {/* Row 2: last message + read ticks + unread dot */}
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      {/* Double check for sent messages */}
                      {isMine && c.last_message && (
                        <span className="shrink-0">
                          {c.last_message_read ? (
                            <CheckCheck className="h-3.5 w-3.5 text-[var(--neon-cyan)]" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </span>
                      )}
                      <span
                        className={`text-xs truncate ${hasUnread ? "text-foreground/75 font-medium" : "text-muted-foreground"}`}
                      >
                        {c.last_message ? (
                          c.last_message.startsWith("sticker:") ? (
                            "🎭 Стикер"
                          ) : (
                            truncate(c.last_message)
                          )
                        ) : (
                          <em className="opacity-50 not-italic">Нет сообщений</em>
                        )}
                      </span>
                    </div>
                    {hasUnread && (
                      <span className="shrink-0 h-5 min-w-[20px] px-1.5 rounded-full bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white text-[10px] font-bold flex items-center justify-center shadow-[var(--shadow-neon)]">
                        N
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
    </>
  );
}
