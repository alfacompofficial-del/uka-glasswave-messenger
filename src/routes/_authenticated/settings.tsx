import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { COUNTRIES } from "@/lib/countries";
import { LANGUAGES } from "@/lib/languages";
import { validateName, validateUsername } from "@/lib/username";
import { toast } from "sonner";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("UZ");
  const [language, setLanguage] = useState("ru");
  const [statusText, setStatusText] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name || "");
    setLastName(profile.last_name || "");
    setUsername(profile.username || "");
    setPhone(profile.phone || "");
    setCountry(profile.country || "UZ");
    setLanguage(profile.language || "ru");
    setStatusText(profile.status_text || "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  async function save() {
    if (!user) return;
    const e1 = validateName(firstName); if (e1) return toast.error("Имя: " + e1);
    const e2 = validateName(lastName); if (e2) return toast.error("Фамилия: " + e2);
    if (username) { const e3 = validateUsername(username); if (e3) return toast.error("Юзернейм: " + e3); }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: username.trim() || null,
      phone: phone || null,
      country,
      language,
      status_text: statusText || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Сохранено");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    queryClient.invalidateQueries({ queryKey: ["profile-lang"] });
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) return toast.error("Минимум 6 символов");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return toast.error(error.message);
    setNewPassword("");
    toast.success("Пароль обновлён");
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? null;
    if (url) {
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setAvatarUrl(url);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Аватар обновлён");
    }
    setUploading(false);
  }

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "U";

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Настройки</h1>
            <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">← К чатам</Link>
          </header>

          {/* Avatar */}
          <div className="glass-strong rounded-2xl p-6 flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-4 ring-[var(--neon-violet)]/60">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white">{initials}</AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white flex items-center justify-center cursor-pointer shadow-lg">
                <Camera className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={uploading} />
              </label>
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg truncate">{firstName} {lastName}</div>
              <div className="text-sm text-muted-foreground truncate">@{username || "—"}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>

          {/* Profile fields */}
          <div className="glass-strong rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold">Личные данные</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Имя</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={64} className="mt-1.5" />
              </div>
              <div>
                <Label>Фамилия</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={64} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>@username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={32} className="mt-1.5" />
              <p className="mt-1 text-xs text-muted-foreground">5–32 символа: A–Z, a–z, 0–9, _. Первый — буква, без __ и без _ по краям.</p>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div>
                <Label>Страна</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Телефон</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5" placeholder="+998..." />
              </div>
            </div>
            <div>
              <Label>Статус</Label>
              <Input value={statusText} onChange={(e) => setStatusText(e.target.value)} maxLength={120} className="mt-1.5" placeholder="Что у вас нового?" />
            </div>
            <div>
              <Label>Язык интерфейса</Label>
              <Select
                value={language}
                onValueChange={(val) => {
                  setLanguage(val);
                  // Apply immediately so the page lang reflects the selection
                  document.documentElement.lang = val;
                }}
              >
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.flag} {l.native}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white">
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>

          {/* Password */}
          <div className="glass-strong rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold">Сменить пароль</h2>
            <div className="flex gap-2">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Новый пароль" />
              <Button onClick={changePassword} variant="outline">Сменить</Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
