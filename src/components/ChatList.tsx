import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Plus, CheckCheck, Check, Users, Hash } from "lucide-react";
import { NewChatWizard } from "./NewChatWizard";

const FOLDERS = [
  { key: "all", label: "Все" },
  { key: "direct", label: "Личные" },
  { key: "group", label: "Группы" },
  { key: "channel", label: "Каналы" },
] as const;

type Folder = (typeof FOLDERS)[number]["key"];

type ConversationRow = {
  id: string;
  type: "direct" | "group" | "channel";
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
};

type ChatItem = ConversationRow & {
  display_name: string;
  display_first_name: string;
  display_last_name: string;
  display_avatar: string | null;
  last_message: string | null;
  last_message_sender: string | null;
  last_message_time: string;
  last_message_read: boolean; // for my sent messages: did the other read it
  unread_count: number; // unread incoming for me
};

export function ChatList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [folder, setFolder] = useState<Folder>("all");
  const [search, setSearch] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const params = useParams({ strict: false }) as { conversationId?: string };

  const { data: conversations = [] } = useQuery<ChatItem[]>({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      const { data: members } = await supabase
        .from("conversation_members")
        .select(
          "conversation_id, last_read_at, conversations(id, type, name, avatar_url, updated_at)",
        )
        .eq("user_id", user.id);

      const rows = (members ?? []) as Array<{
        conversation_id: string;
        last_read_at: string;
        conversations: ConversationRow | null;
      }>;

      const convs = rows
        .map((m) => ({ conv: m.conversations, last_read_at: m.last_read_at }))
        .filter((x): x is { conv: ConversationRow; last_read_at: string } => !!x.conv);

      const convIds = convs.map((x) => x.conv.id);
      if (convIds.length === 0) return [];

      // Other party for direct chats
      const directIds = convs.filter((x) => x.conv.type === "direct").map((x) => x.conv.id);
      const otherById: Record<
        string,
        { name: string; avatar: string | null; firstName: string; lastName: string }
      > = {};
      if (directIds.length) {
        const { data: othersRaw } = await supabase
          .from("conversation_members")
          .select("conversation_id, user_id")
          .in("conversation_id", directIds)
          .neq("user_id", user.id);
        const others = (othersRaw ?? []) as Array<{
          conversation_id: string;
          user_id: string;
        }>;
        const otherIds = Array.from(new Set(others.map((o) => o.user_id)));
        const profById: Record<
          string,
          { first_name: string | null; last_name: string | null; avatar_url: string | null; username: string | null }
        > = {};
        if (otherIds.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, avatar_url, username")
            .in("id", otherIds);
          for (const p of profs ?? []) profById[p.id] = p;
        }
        for (const r of others) {
          const p = profById[r.user_id];
          if (!p) continue;
          const fn = p.first_name ?? "";
          const ln = p.last_name ?? "";
          otherById[r.conversation_id] = {
            name: `${fn} ${ln}`.trim() || `@${p.username ?? "user"}`,
            avatar: p.avatar_url,
            firstName: fn,
            lastName: ln,
          };
        }
      }


      // Last message + unread count per conversation
      const lastMsgById: Record<
        string,
        { content: string; sender_id: string; created_at: string } | undefined
      > = {};
      const unreadById: Record<string, number> = {};

      // Other party's last_read_at to know if MY messages were read
      const otherLastReadById: Record<string, string> = {};
      if (directIds.length) {
        const { data: orRaw } = await supabase
          .from("conversation_members")
          .select("conversation_id, last_read_at")
          .in("conversation_id", directIds)
          .neq("user_id", user.id);
        for (const r of (orRaw ?? []) as Array<{
          conversation_id: string;
          last_read_at: string;
        }>) {
          otherLastReadById[r.conversation_id] = r.last_read_at;
        }
      }

      await Promise.all(
        convs.map(async ({ conv, last_read_at }) => {
          const { data: msgs } = await supabase
            .from("messages")
            .select("id, content, sender_id, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1);
          if (msgs && msgs.length > 0) {
            lastMsgById[conv.id] = msgs[0] as {
              id: string;
              content: string;
              sender_id: string;
              created_at: string;
            };
          }
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .neq("sender_id", user.id)
            .gt("created_at", last_read_at);
          unreadById[conv.id] = count ?? 0;
        }),
      );

      const items: ChatItem[] = convs.map(({ conv }) => {
        const other = otherById[conv.id];
        const lastMsg = lastMsgById[conv.id];
        const displayName =
          conv.type === "direct" ? (other?.name ?? "Чат") : (conv.name ?? "Без имени");
        const otherRead = otherLastReadById[conv.id];
        const lastMessageRead =
          !!lastMsg && lastMsg.sender_id === user.id && !!otherRead && otherRead >= lastMsg.created_at;
        return {
          ...conv,
          display_name: displayName,
          display_first_name: conv.type === "direct" ? (other?.firstName ?? "") : "",
          display_last_name: conv.type === "direct" ? (other?.lastName ?? "") : "",
          display_avatar: conv.type === "direct" ? (other?.avatar ?? null) : conv.avatar_url,
          last_message: lastMsg?.content ?? null,
          last_message_sender: lastMsg?.sender_id ?? null,
          last_message_time: lastMsg?.created_at ?? conv.updated_at,
          last_message_read: lastMessageRead,
          unread_count: unreadById[conv.id] ?? 0,
        };
      });

      items.sort(
        (a, b) =>
          new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime(),
      );
      return items;
    },
  });

  // Realtime: refresh on any new message or read-state change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chatlist:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => queryClient.invalidateQueries({ queryKey: ["conversations", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members" },
        () => queryClient.invalidateQueries({ queryKey: ["conversations", user.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (folder !== "all") list = list.filter((c) => c.type === folder);
    if (search)
      list = list.filter((c) => c.display_name.toLowerCase().includes(search.toLowerCase()));
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

  function truncate(str: string, max = 40) {
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
          filtered.map((c) => {
            const active = params.conversationId === c.id;
            const initials = c.display_name
              .split(" ")
              .map((s) => s[0] ?? "")
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const isMine = c.last_message_sender === user?.id;

            const displayTitle =
              c.type === "direct" && (c.display_last_name || c.display_first_name)
                ? `${c.display_last_name} ${c.display_first_name}`.trim()
                : c.display_name;

            const preview = c.last_message
              ? c.last_message.startsWith("sticker:")
                ? "🎭 Стикер"
                : truncate(c.last_message)
              : null;

            return (
              <Link
                key={c.id}
                to="/app/$conversationId"
                params={{ conversationId: c.id }}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition border-l-2 cursor-pointer select-none ${
                  active ? "bg-white/8 border-[var(--neon-violet)]" : "border-transparent"
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={c.display_avatar ?? undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-[var(--neon-blue)] to-[var(--neon-cyan)] text-white font-semibold text-sm">
                      {c.type === "group" ? <Users className="h-5 w-5" /> : c.type === "channel" ? <Hash className="h-5 w-5" /> : initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {c.type !== "direct" && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-background flex items-center justify-center border border-border/40">
                      {c.type === "channel" ? <Hash className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate text-[13px] leading-tight text-foreground">
                      {displayTitle}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(c.last_message_time)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <div className="flex items-center gap-1 min-w-0">
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
                        className={`text-xs truncate ${
                          c.unread_count > 0
                            ? "text-foreground/85 font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {preview ?? <em className="opacity-50 not-italic">Нет сообщений</em>}
                      </span>
                    </div>
                    {c.unread_count > 0 && (
                      <span className="shrink-0 h-5 min-w-[20px] px-1.5 rounded-full bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white text-[10px] font-bold flex items-center justify-center shadow-[var(--shadow-neon)]">
                        {c.unread_count > 99 ? "99+" : c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <NewChatWizard open={newChatOpen} onOpenChange={setNewChatOpen} />
    </>
  );
}
