import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import { validateName, validateUsername } from "@/lib/username";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, refetch } = useProfile();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("UZ");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setUsername(profile.username || "");
      setCountry(profile.country || "UZ");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const e1 = validateName(firstName); if (e1) return toast.error("Имя: " + e1);
    const e2 = validateName(lastName); if (e2) return toast.error("Фамилия: " + e2);
    const e3 = validateUsername(username); if (e3) return toast.error("Юзернейм: " + e3);
    if (!phone) return toast.error("Введите номер телефона");

    setSaving(true);
    const fullPhone = phone.startsWith("+") ? phone : dial + phone.replace(/\D/g, "");
    const { error } = await supabase.from("profiles").update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: username.trim(),
      phone: fullPhone,
      country,
      onboarded: true,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Профиль создан!");
    await refetch();
    navigate({ to: "/app" });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-block"><Logo size={64} /></div>
          <h1 className="mt-4 text-2xl font-bold">Завершите регистрацию</h1>
          <p className="mt-1 text-sm text-muted-foreground">Эти данные нужны, чтобы друзья смогли вас найти</p>
        </div>

        <form onSubmit={submit} className="glass-strong rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Имя *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={64} className="mt-1.5" />
            </div>
            <div>
              <Label>Фамилия *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={64} className="mt-1.5" />
            </div>
          </div>

          <div>
            <Label>Юзернейм *</Label>
            <div className="mt-1.5 flex">
              <span className="inline-flex items-center px-3 rounded-l-md bg-muted text-muted-foreground border border-r-0 border-border">@</span>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={32} className="rounded-l-none" placeholder="your_handle" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">5–32 символа: A–Z, a–z, 0–9, _. Первый — буква, без __ и без _ по краям.</p>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <Label>Страна *</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.flag} {c.dial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Телефон *</Label>
              <div className="mt-1.5 flex">
                <span className="inline-flex items-center px-3 rounded-l-md bg-muted text-muted-foreground border border-r-0 border-border">{dial}</span>
                <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-l-none" placeholder="901234567" />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full h-12 bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white font-semibold">
            {saving ? "Сохраняем…" : "Продолжить"}
          </Button>
        </form>
      </div>
    </main>
  );
}
