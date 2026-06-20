import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Phone, Video, Info, Languages as LangIcon, Smile } from "lucide-react";
import { convertScript } from "@/lib/translit";
import { toast } from "sonner";
import { StickerPicker } from "@/components/StickerPicker";

export const Route = createFileRoute("/_authenticated/app/$conversationId")({
  component: ChatView,
});

function ChatView() {
  const { conversationId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [showStickers, setShowStickers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickerBtnRef = useRef<HTMLButtonElement>(null);

  const { data: conv } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();
      let title = data?.name ?? "Чат";
      let firstName = "";
      let lastName = "";
      let avatar: string | null = null;
      let subtitle =
        data?.type === "direct" ? "Личный чат" : data?.type === "group" ? "Группа" : "Канал";

      if (data?.type === "direct" && user) {
        const { data: other } = await supabase
          .from("conversation_members")
          .select("user_id, profiles!inner(first_name, last_name, avatar_url, username)")
          .eq("conversation_id", conversationId)
          .neq("user_id", user.id)
          .maybeSingle();
        if (other) {
          const p: unknown = (other as unknown).profiles;
          firstName = p.first_name || "";
          lastName = p.last_name || "";
          title = `${firstName} ${lastName}`.trim() || `@${p.username ?? "user"}`;
          avatar = p.avatar_url;
          subtitle = "Личный чат";
        }
      }
      return { ...data, title, firstName, lastName, avatar, subtitle };
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      const senderIds = Array.from(new Set((data ?? []).map((m) => m.sender_id)));
      const profilesById: Record<string, unknown> = {};
      if (senderIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", senderIds);
        (profs ?? []).forEach((p) => {
          profilesById[p.id] = p;
        });
      }
      return (data ?? []).map((m) => ({ ...m, profile: profilesById[m.sender_id] }));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Close sticker picker on outside click
  useEffect(() => {
    if (!showStickers) return;
    function handleClick(e: MouseEvent) {
      if (stickerBtnRef.current && !stickerBtnRef.current.contains(e.target as Node)) {
        setShowStickers(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showStickers]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    const content = text.trim();
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, content });
    if (error) {
      toast.error(error.message);
      setText(content);
    }
  }

  async function sendSticker(sticker: string) {
    if (!user) return;
    const content = `sticker:${sticker}`;
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: user.id, content });
    if (error) toast.error(error.message);
  }

  const initials =
    (conv?.title as string | undefined)
      ?.split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  // Build the header title: "Фамилия\nИмя" for direct chats
  const headerTitle =
    conv?.type === "direct" && (conv.lastName || conv.firstName)
      ? `${conv.lastName} ${conv.firstName}`.trim()
      : conv?.title;

  return (
    <>
      {/* Header */}
      <header className="h-16 px-5 glass-strong border-b border-border/40 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={conv?.avatar ?? undefined} />
          <AvatarFallback className="bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate leading-tight">{headerTitle}</div>
          <div className="text-xs text-muted-foreground">
            {conv?.subtitle ??
              (conv?.type === "direct"
                ? "Личный чат"
                : conv?.type === "group"
                  ? "Группа"
                  : "Канал")}
          </div>
        </div>
        <button
          className="h-10 w-10 rounded-lg glass hover:neon-ring flex items-center justify-center"
          title="Звонок (скоро)"
          onClick={() => toast.info("Голосовые звонки в следующей фазе")}
        >
          <Phone className="h-4 w-4" />
        </button>
        <button
          className="h-10 w-10 rounded-lg glass hover:neon-ring flex items-center justify-center"
          title="Видео (скоро)"
          onClick={() => toast.info("Видео в следующей фазе")}
        >
          <Video className="h-4 w-4" />
        </button>
        <button
          className="h-10 w-10 rounded-lg glass hover:neon-ring flex items-center justify-center"
          title="Инфо"
        >
          <Info className="h-4 w-4" />
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-3">
        {messages.map((m: unknown) => {
          const mine = m.sender_id === user?.id;
          const senderInit =
            `${m.profile?.first_name?.[0] ?? ""}${m.profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
            "?";
          const isSticker = m.content?.startsWith("sticker:");
          const stickerEmoji = isSticker ? m.content.replace("sticker:", "") : null;

          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : ""}`}>
              {!mine && (
                <Avatar className="h-8 w-8 mt-auto shrink-0">
                  <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{senderInit}</AvatarFallback>
                </Avatar>
              )}
              {isSticker ? (
                // Sticker bubble – transparent, just the emoji
                <div className={`flex flex-col items-${mine ? "end" : "start"} max-w-[120px]`}>
                  <div
                    className={`text-5xl leading-none select-none cursor-default hover:scale-110 transition-transform ${mine ? "self-end" : "self-start"}`}
                    title="Стикер"
                  >
                    {stickerEmoji}
                  </div>
                  <div
                    className={`mt-0.5 text-[10px] ${mine ? "text-muted-foreground text-right" : "text-muted-foreground"}`}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className={`max-w-[68%] rounded-2xl px-4 py-2.5 ${
                    mine
                      ? "bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-blue)] text-white rounded-br-sm shadow-[var(--shadow-neon)]"
                      : "glass rounded-bl-sm"
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  <div
                    className={`mt-1 text-[10px] flex items-center gap-1 justify-end ${mine ? "text-white/70" : "text-muted-foreground"}`}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {mine && <span className="text-[var(--neon-cyan)] opacity-80">✓✓</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-20">
            Сообщений пока нет — напишите первым 👋
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="p-4 glass-strong border-t border-border/40 flex gap-2 items-center relative"
      >
        {/* Transliterate button */}
        <button
          type="button"
          onClick={() => setText((t) => convertScript(t))}
          title="Кириллица ⇄ Латиница"
          className="h-11 w-11 shrink-0 rounded-xl glass hover:neon-ring flex items-center justify-center"
        >
          <LangIcon className="h-4 w-4" />
        </button>

        {/* Sticker button with picker */}
        <div className="relative" ref={stickerBtnRef as unknown}>
          <button
            type="button"
            onClick={() => setShowStickers((v) => !v)}
            title="Стикеры"
            className={`h-11 w-11 shrink-0 rounded-xl glass hover:neon-ring flex items-center justify-center transition ${showStickers ? "neon-ring" : ""}`}
          >
            <Smile className="h-4 w-4" />
          </button>
          {showStickers && (
            <StickerPicker onSelect={sendSticker} onClose={() => setShowStickers(false)} />
          )}
        </div>

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишите сообщение…"
          className="h-11 flex-1"
        />
        <Button
          type="submit"
          disabled={!text.trim()}
          className="h-11 w-11 p-0 shrink-0 bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}
