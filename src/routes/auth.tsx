import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход — UKA Messenger" },
      { name: "description", content: "Войдите в UKA Messenger." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // Do NOT pass emailRedirectTo — this forces OTP code mode instead of magic link
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Код отправлен на ваш email");
    setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setLoading(false);
    if (error) {
      toast.error("Неверный код");
      return;
    }
    toast.success("Вход выполнен");
    navigate({ to: "/app" });
  }

  async function signInGoogle() {
    setLoading(true);

    // Если мы на localhost - используем прямой Supabase OAuth
    // (потребует настройки ключей в Supabase Dashboard для локального тестирования)
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/app",
        },
      });
      if (error) {
        setLoading(false);
        toast.error("Не удалось войти: " + error.message);
      }
    } else {
      // На боевом сайте (в Lovable) используем магию Lovable Cloud Auth,
      // чтобы Google вход работал без сложной настройки ключей
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/app",
      });
      if (result.error) {
        setLoading(false);
        toast.error("Не удалось войти через Google");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/app" });
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-12">
      <Link
        to="/"
        className="absolute top-6 left-6 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Назад
      </Link>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block float-slow">
            <Logo size={72} />
          </div>
          <h1 className="mt-4 text-3xl font-bold neon-text">UKA Messenger</h1>
          <p className="mt-2 text-sm text-muted-foreground">Войдите, чтобы продолжить</p>
        </div>

        <div className="glass-strong rounded-2xl p-8 space-y-5">
          <Button
            type="button"
            variant="outline"
            className="w-full glass hover:neon-ring h-12 text-base"
            onClick={signInGoogle}
            disabled={loading}
          >
            <GoogleIcon /> Продолжить с Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> или email{" "}
            <div className="h-px flex-1 bg-border" />
          </div>

          {step === "email" ? (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 h-12"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white font-semibold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Отправить код"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              <div>
                <Label>Код отправлен на {email}</Label>
                <Input
                  inputMode="numeric"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-значный код"
                  className="mt-1.5 h-12 text-center text-xl tracking-[0.5em] font-mono"
                  maxLength={6}
                />
              </div>
              <Button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full h-12 bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white font-semibold"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Войти"}
              </Button>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                ← Изменить email
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Продолжая, вы соглашаетесь с условиями использования UKA Messenger.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
