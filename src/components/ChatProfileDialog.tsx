import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Loader2,
  Pencil,
  UserPlus,
  Globe,
  Lock,
  Shield,
  ShieldOff,
  UserX,
  Copy,
  Crown,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { uploadChatAvatar } from "@/lib/chat-avatar";
import { UserProfileDialog } from "./UserProfileDialog";

type Conv = {
  id: string;
  type: "direct" | "group" | "channel";
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  is_public: boolean;
  invite_slug: string | null;
  created_by: string | null;
};

type Member = {
  user_id: string;
  role: string;
  profile: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export function ChatProfileDialog({
  conversationId,
  open,
  onOpenChange,
}: {
  conversationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [conv, setConv] = useState<Conv | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [uploading, setUploading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    if (!open) return;
    setLoading(true);
    const { data: c } = await supabase
      .from("conversations")
      .select("id, type, name, description, avatar_url, is_public, invite_slug, created_by")
      .eq("id", conversationId)
      .maybeSingle();
    setConv(c as Conv | null);
    if (c) {
      setName(c.name ?? "");
      setDescription(c.description ?? "");
      setSlug(c.invite_slug ?? "");
    }
    const { data: m } = await supabase
      .from("conversation_members")
      .select("user_id, role")
      .eq("conversation_id", conversationId);
    const rows = (m ?? []) as Array<{ user_id: string; role: string }>;
    const ids = rows.map((r) => r.user_id);
    let profById: Record<string, Member["profile"]> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, avatar_url")
        .in("id", ids);
      for (const p of (profs ?? []) as Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        username: string | null;
        avatar_url: string | null;
      }>) {
        profById[p.id] = {
          first_name: p.first_name,
          last_name: p.last_name,
          username: p.username,
          avatar_url: p.avatar_url,
        };
      }
    }
    setMembers(
      rows.map((r) => ({ ...r, profile: profById[r.user_id] ?? null })).sort((a, b) => {
        const order = { owner: 0, admin: 1, member: 2 } as Record<string, number>;
        return (order[a.role] ?? 3) - (order[b.role] ?? 3);
      }),
    );
    setLoading(false);
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId]);

  // direct chats: open the other user's profile instead
  useEffect(() => {
    if (!conv || !user) return;
    if (conv.type === "direct") {
      const other = members.find((m) => m.user_id !== user.id);
      if (other) setViewUserId(other.user_id);
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, members, user]);

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? null;
  const isOwner = myRole === "owner";
  const isAdmin = myRole === "admin";
  const canManage = isOwner || isAdmin;
  const isChannel = conv?.type === "channel";

  // For channels, regular members shouldn't see subscriber list (RLS already filters)
  const visibleMembers = members;

  async function saveBasics() {
    if (!conv) return;
    const { error } = await supabase.rpc("update_conversation", {
      _conv: conv.id,
      _name: name.trim() || conv.name,
      _avatar_url: null,
      _description: description.trim(),
      _is_public: null,
      _invite_slug: isOwner ? slug.trim() || conv.invite_slug : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Сохранено");
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["conversation", conv.id] });
    load();
  }

  async function togglePublic() {
    if (!conv || !isOwner) return;
    const { error } = await supabase.rpc("update_conversation", {
      _conv: conv.id,
      _name: null,
      _avatar_url: null,
      _description: null,
      _is_public: !conv.is_public,
      _invite_slug: null,
    });
    if (error) return toast.error(error.message);
    load();
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user || !conv) return;
    setUploading(true);
    try {
      const url = await uploadChatAvatar(user.id, f);
      const { error } = await supabase.rpc("update_conversation", {
        _conv: conv.id,
        _name: null,
        _avatar_url: url,
        _description: null,
        _is_public: null,
        _invite_slug: null,
      });
      if (error) throw error;
      toast.success("Фото обновлено");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", conv.id] });
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
    setUploading(false);
  }

  async function setRole(uid: string, role: "admin" | "member") {
    if (!conv) return;
    const { error } = await supabase.rpc("set_member_role", {
      _conv: conv.id,
      _user: uid,
      _role: role,
    });
    if (error) return toast.error(error.message);
    load();
  }

  async function kick(uid: string) {
    if (!conv) return;
    if (!confirm("Удалить участника?")) return;
    const { error } = await supabase.rpc("remove_member", {
      _conv: conv.id,
      _user: uid,
    });
    if (error) return toast.error(error.message);
    load();
  }

  function copyInvite() {
    if (!conv?.invite_slug) return;
    const url = `${window.location.origin}/join/${conv.invite_slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Ссылка скопирована");
  }

  const initials =
    `${conv?.name?.[0] ?? ""}`.toUpperCase() || (isChannel ? "#" : "G");

  return (
    <>
      <Sheet open={open && conv?.type !== "direct"} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="glass-strong border-border/40 w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isChannel ? "Профиль канала" : "Профиль группы"}</SheetTitle>
          </SheetHeader>

          {loading || !conv ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="relative">
                  <Avatar className="h-28 w-28 ring-2 ring-[var(--neon-violet)]/60">
                    <AvatarImage src={conv.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white text-3xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {canManage && (
                    <button
                      onClick={() => fileInput.current?.click()}
                      className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] flex items-center justify-center text-white shadow-lg"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                  )}
                  <input ref={fileInput} type="file" accept="image/*" hidden onChange={onPickAvatar} />
                </div>
                {editing ? (
                  <div className="w-full space-y-2">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Описание"
                    />
                    {isOwner && conv.is_public && (
                      <Input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase())}
                        placeholder="ссылка-приглашение"
                      />
                    )}
                    <div className="flex gap-2">
                      <Button onClick={saveBasics} className="flex-1 bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white">
                        Сохранить
                      </Button>
                      <Button variant="outline" onClick={() => setEditing(false)}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xl font-bold flex items-center gap-2 justify-center">
                      {conv.name}
                      {canManage && (
                        <button onClick={() => setEditing(true)}>
                          <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      )}
                    </div>
                    {conv.description && (
                      <div className="text-sm text-muted-foreground mt-1">{conv.description}</div>
                    )}
                    <div className="mt-2 inline-flex items-center gap-1 glass px-2 py-1 rounded-full text-xs">
                      {conv.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {conv.is_public ? "Публичный" : "Приватный"}
                      {isOwner && (
                        <button onClick={togglePublic} className="ml-1 text-[var(--neon-cyan)]">
                          сменить
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {conv.is_public && conv.invite_slug && (
                <div className="glass rounded-lg p-3 flex items-center gap-2 text-xs">
                  <span className="font-mono truncate flex-1">
                    {window.location.origin}/join/{conv.invite_slug}
                  </span>
                  <button onClick={copyInvite} className="p-1 hover:text-[var(--neon-cyan)]">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              )}

              {canManage && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setAddOpen(true)}
                >
                  <UserPlus className="h-4 w-4 mr-2" /> Добавить участников
                </Button>
              )}

              <div>
                <div className="text-sm font-semibold mb-2 flex items-center justify-between">
                  <span>
                    {isChannel && !canManage ? "Информация" : `Участники · ${visibleMembers.length}`}
                  </span>
                </div>
                <div className="space-y-1">
                  {visibleMembers.map((m) => {
                    const inits =
                      `${m.profile?.first_name?.[0] ?? ""}${m.profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
                      "?";
                    const isMe = m.user_id === user?.id;
                    return (
                      <div
                        key={m.user_id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5"
                      >
                        <button
                          onClick={() => setViewUserId(m.user_id)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={m.profile?.avatar_url ?? undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white text-xs">
                              {inits}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-1">
                              {m.profile?.last_name} {m.profile?.first_name}
                              {m.role === "owner" && (
                                <Crown className="h-3 w-3 text-yellow-400" />
                              )}
                              {m.role === "admin" && (
                                <Shield className="h-3 w-3 text-[var(--neon-cyan)]" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              @{m.profile?.username ?? "—"}
                            </div>
                          </div>
                        </button>
                        {!isMe && m.role !== "owner" && (
                          <div className="flex gap-1">
                            {isOwner && m.role === "member" && (
                              <button
                                onClick={() => setRole(m.user_id, "admin")}
                                title="Сделать админом"
                                className="p-1.5 rounded hover:bg-white/10"
                              >
                                <Shield className="h-4 w-4 text-[var(--neon-cyan)]" />
                              </button>
                            )}
                            {isOwner && m.role === "admin" && (
                              <button
                                onClick={() => setRole(m.user_id, "member")}
                                title="Снять админа"
                                className="p-1.5 rounded hover:bg-white/10"
                              >
                                <ShieldOff className="h-4 w-4 text-muted-foreground" />
                              </button>
                            )}
                            {canManage && (isOwner || m.role === "member") && (
                              <button
                                onClick={() => kick(m.user_id)}
                                title="Удалить"
                                className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                              >
                                <UserX className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {addOpen && conv && (
        <AddMembersDialog
          conv={conv}
          existing={members.map((m) => m.user_id)}
          open={addOpen}
          onOpenChange={(v) => {
            setAddOpen(v);
            if (!v) load();
          }}
        />
      )}

      <UserProfileDialog
        userId={viewUserId}
        open={!!viewUserId}
        onOpenChange={(v) => !v && setViewUserId(null)}
      />
    </>
  );
}

// Inline lazy dialog to keep file cohesive
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, X } from "lucide-react";

function AddMembersDialog({
  conv,
  existing,
  open,
  onOpenChange,
}: {
  conv: Conv;
  existing: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    Array<{ id: string; first_name: string | null; last_name: string | null; username: string | null; avatar_url: string | null }>
  >([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function search(term: string) {
    if (!term.trim() || !user) {
      setResults([]);
      return;
    }
    const t = term.trim().replace(/^@/, "");
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, username, avatar_url")
      .or(`username.ilike.%${t}%,first_name.ilike.%${t}%,last_name.ilike.%${t}%`)
      .limit(20);
    setResults(((data ?? []) as typeof results).filter((u) => !existing.includes(u.id)));
  }

  async function save() {
    if (picked.length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("add_members", {
      _conv: conv.id,
      _user_ids: picked,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Добавлено");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/40 max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить участников</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              search(e.target.value);
            }}
            placeholder="Поиск по @username или имени"
            className="pl-9"
          />
        </div>
        {picked.length > 0 && (
          <div className="text-xs text-muted-foreground">Выбрано: {picked.length}</div>
        )}
        <div className="max-h-72 overflow-y-auto space-y-1">
          {results.map((u) => {
            const isPicked = picked.includes(u.id);
            const initials =
              `${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.toUpperCase() || "?";
            return (
              <button
                key={u.id}
                onClick={() =>
                  setPicked((p) => (isPicked ? p.filter((x) => x !== u.id) : [...p, u.id]))
                }
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition text-left ${
                  isPicked ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {u.last_name} {u.first_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">@{u.username ?? "—"}</div>
                </div>
                {isPicked && <X className="h-4 w-4 text-[var(--neon-cyan)]" />}
              </button>
            );
          })}
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="w-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Добавить"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
