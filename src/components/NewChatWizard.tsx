import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  MessageSquare,
  Users,
  Hash,
  Camera,
  ArrowLeft,
  Globe,
  Lock,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { uploadChatAvatar } from "@/lib/chat-avatar";

type Mode = "choose" | "direct" | "group" | "channel";
type Step = 0 | 1 | 2 | 3; // 0=name 1=photo 2=members 3=privacy

type SearchUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export function NewChatWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState<Step>(0);

  // direct search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);

  // group/channel state
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [members, setMembers] = useState<SearchUser[]>([]);
  const [memberQ, setMemberQ] = useState("");
  const [memberResults, setMemberResults] = useState<SearchUser[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setMode("choose");
    setStep(0);
    setQ("");
    setResults([]);
    setName("");
    setAvatarUrl(null);
    setAvatarFile(null);
    setMembers([]);
    setMemberQ("");
    setMemberResults([]);
    setIsPublic(false);
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function searchUsers(term: string, set: (r: SearchUser[]) => void) {
    if (!term.trim() || !user) {
      set([]);
      return;
    }
    const t = term.trim().replace(/^@/, "");
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, username, phone, avatar_url")
      .or(`username.ilike.%${t}%,phone.ilike.%${t}%,first_name.ilike.%${t}%,last_name.ilike.%${t}%`)
      .neq("id", user.id)
      .limit(20);
    set((data ?? []) as SearchUser[]);
  }

  async function startDirect(otherId: string) {
    const { data, error } = await supabase.rpc("get_or_create_direct", { _other: otherId });
    if (error) {
      toast.error(error.message);
      return;
    }
    close(false);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ to: "/app/$conversationId", params: { conversationId: data as string } });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    setUploading(true);
    try {
      const url = await uploadChatAvatar(user.id, f);
      setAvatarUrl(url);
      setAvatarFile(f);
    } catch (err) {
      toast.error((err as Error).message);
    }
    setUploading(false);
  }

  async function createConv() {
    if (!user) return;
    setCreating(true);
    const { data, error } = await (supabase.rpc as any)("create_group_or_channel", {
      _type: mode === "group" ? "group" : "channel",
      _name: name.trim(),
      _avatar_url: avatarUrl ?? "",
      _is_public: isPublic,
      _member_ids: members.map((m) => m.id),
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    close(false);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    navigate({ to: "/app/$conversationId", params: { conversationId: data as string } });
  }

  function toggleMember(u: SearchUser) {
    setMembers((prev) =>
      prev.find((m) => m.id === u.id) ? prev.filter((m) => m.id !== u.id) : [...prev, u],
    );
  }

  const titleByMode = mode === "group" ? "Новая группа" : "Новый канал";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="glass-strong border-border/40 max-w-md">
        {mode === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle>Новый чат</DialogTitle>
              <DialogDescription>Выберите тип чата</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <ModeButton
                icon={<MessageSquare className="h-5 w-5" />}
                title="Личный чат"
                subtitle="Поиск пользователя по @username или телефону"
                onClick={() => setMode("direct")}
              />
              <ModeButton
                icon={<Users className="h-5 w-5" />}
                title="Новая группа"
                subtitle="До 200 000 участников, все могут писать"
                onClick={() => {
                  setMode("group");
                  setStep(0);
                }}
              />
              <ModeButton
                icon={<Hash className="h-5 w-5" />}
                title="Новый канал"
                subtitle="Вещание подписчикам без обратной связи"
                onClick={() => {
                  setMode("channel");
                  setStep(0);
                }}
              />
            </div>
          </>
        )}

        {mode === "direct" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BackBtn onClick={() => setMode("choose")} /> Личный чат
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearching(true);
                searchUsers(q, setResults).finally(() => setSearching(false));
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="@username, имя или телефон"
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Найти"}
              </Button>
            </form>
            <div className="max-h-80 overflow-y-auto space-y-1 mt-2">
              {results.map((u) => (
                <UserRow key={u.id} u={u} onClick={() => startDirect(u.id)} />
              ))}
              {!searching && results.length === 0 && q && (
                <div className="text-center text-sm text-muted-foreground py-6">
                  Ничего не найдено
                </div>
              )}
            </div>
          </>
        )}

        {(mode === "group" || mode === "channel") && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BackBtn
                  onClick={() => {
                    if (step === 0) setMode("choose");
                    else setStep((step - 1) as Step);
                  }}
                />
                {titleByMode}
                <span className="text-xs text-muted-foreground ml-auto">Шаг {step + 1}/4</span>
              </DialogTitle>
            </DialogHeader>

            {step === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Введите название {mode === "group" ? "группы" : "канала"} (обязательно)
                </p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={mode === "group" ? "Например: Друзья" : "Например: Новости"}
                  maxLength={64}
                  autoFocus
                />
                <Button
                  className="w-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white"
                  disabled={!name.trim()}
                  onClick={() => setStep(1)}
                >
                  Далее
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Загрузите фото {mode === "group" ? "группы" : "канала"} (обязательно)
                </p>
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="relative h-32 w-32 rounded-full overflow-hidden glass-strong border-2 border-[var(--neon-violet)]/60 flex items-center justify-center hover:neon-ring transition"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-10 w-10 text-muted-foreground" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={onPickFile}
                  />
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="text-sm text-[var(--neon-cyan)] hover:underline"
                  >
                    {avatarUrl ? "Сменить фото" : "Выбрать фото"}
                  </button>
                </div>
                <Button
                  className="w-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white"
                  disabled={!avatarUrl || uploading}
                  onClick={() => setStep(2)}
                >
                  Далее
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Добавьте участников (необязательно)
                </p>
                {members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m)}
                        className="glass px-2 py-1 rounded-full text-xs flex items-center gap-1 hover:bg-destructive/20"
                      >
                        @{m.username ?? m.first_name} <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={memberQ}
                    onChange={(e) => {
                      setMemberQ(e.target.value);
                      searchUsers(e.target.value, setMemberResults);
                    }}
                    placeholder="Поиск по @username"
                    className="pl-9"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {memberResults.map((u) => {
                    const picked = !!members.find((m) => m.id === u.id);
                    return (
                      <UserRow
                        key={u.id}
                        u={u}
                        onClick={() => toggleMember(u)}
                        right={
                          picked ? (
                            <Check className="h-4 w-4 text-[var(--neon-cyan)]" />
                          ) : null
                        }
                      />
                    );
                  })}
                </div>
                <Button
                  className="w-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white"
                  onClick={() => setStep(3)}
                >
                  Далее
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Тип {mode === "group" ? "группы" : "канала"}</p>
                <button
                  onClick={() => setIsPublic(false)}
                  className={`w-full p-3 rounded-lg glass text-left flex items-start gap-3 ${
                    !isPublic ? "neon-ring" : ""
                  }`}
                >
                  <Lock className="h-5 w-5 mt-0.5" />
                  <div>
                    <div className="font-semibold">Приватный</div>
                    <div className="text-xs text-muted-foreground">
                      Только по приглашению / добавлению
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setIsPublic(true)}
                  className={`w-full p-3 rounded-lg glass text-left flex items-start gap-3 ${
                    isPublic ? "neon-ring" : ""
                  }`}
                >
                  <Globe className="h-5 w-5 mt-0.5" />
                  <div>
                    <div className="font-semibold">Публичный</div>
                    <div className="text-xs text-muted-foreground">
                      Доступен по ссылке-приглашению
                    </div>
                  </div>
                </button>
                <Button
                  className="w-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white"
                  disabled={creating}
                  onClick={createConv}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Создать"}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-7 w-7 rounded-md glass hover:neon-ring flex items-center justify-center"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

function ModeButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-lg glass hover:neon-ring transition flex items-center gap-3 text-left"
    >
      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] flex items-center justify-center text-white shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
    </button>
  );
}

function UserRow({
  u,
  onClick,
  right,
}: {
  u: SearchUser;
  onClick: () => void;
  right?: React.ReactNode;
}) {
  const initials = `${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition text-left"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={u.avatar_url ?? undefined} />
        <AvatarFallback className="bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate text-sm">
          {u.last_name} {u.first_name}
        </div>
        <div className="text-xs text-muted-foreground truncate">@{u.username ?? "—"}</div>
      </div>
      {right}
    </button>
  );
}
