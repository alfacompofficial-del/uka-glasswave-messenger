import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Sparkles, Languages, Zap, MessageCircle, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UKA Messenger — Cyberpunk-мессенджер с AI" },
      { name: "description", content: "Стильный, защищённый мессенджер с AI-переводом и умным конвертером кириллицы/латиницы." },
      { property: "og:title", content: "UKA Messenger" },
      { property: "og:description", content: "Стильный, защищённый мессенджер с AI-переводом." },
    ],
  }),
  component: Landing,
});

function Feature({ icon: Icon, title, text }: { icon: typeof Shield; title: string; text: string }) {
  return (
    <div className="glass rounded-2xl p-6 hover:-translate-y-1 transition-transform">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] shadow-[var(--shadow-neon)]">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Floating grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.82 0.17 195 / 0.08) 1px, transparent 1px), linear-gradient(90deg, oklch(0.82 0.17 195 / 0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="text-lg font-bold tracking-wider">UKA</span>
        </div>
        <Link to="/auth" className="glass rounded-full px-5 py-2 text-sm font-medium hover:neon-ring transition">
          Войти
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-24 text-center">
        <div className="float-slow mx-auto inline-block">
          <Logo size={120} />
        </div>
        <div className="mt-4 inline-block glass rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Мессенджер нового поколения
        </div>
        <h1 className="mt-6 text-5xl md:text-7xl font-black leading-[1.05]">
          Общайся <span className="neon-text">стильно</span>.<br />
          Защищённо. Без границ.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          UKA Messenger — киберпанк-эстетика, мгновенные сообщения, встроенный AI-переводчик
          и умный конвертер кириллицы/латиницы.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            to="/auth"
            className="pulse-neon rounded-full bg-gradient-to-r from-[var(--neon-violet)] via-[var(--neon-blue)] to-[var(--neon-cyan)] px-8 py-3.5 text-base font-semibold text-white shadow-[var(--shadow-neon)] hover:scale-105 transition"
          >
            Начать →
          </Link>
          <a href="#features" className="glass-strong rounded-full px-8 py-3.5 text-base font-medium hover:neon-ring transition">
            Возможности
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-10 text-center text-3xl md:text-4xl font-bold">Что внутри</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Feature icon={Shield} title="Безопасность" text="Сообщения видят только участники чата. Даже администратор не имеет доступа к личным перепискам." />
          <Feature icon={Sparkles} title="Стиль" text="Glassmorphism + неоновые акценты. Уникальный дизайн, выделяющий UKA среди десятков клонов." />
          <Feature icon={Languages} title="AI-переводчик" text="Live Translate входящих сообщений: пишите на узбекском, читайте на русском." />
          <Feature icon={Zap} title="Умный конвертер" text="Кириллица ⇄ латиница одним кликом, прямо в поле ввода — без бота." />
          <Feature icon={MessageCircle} title="Реальное время" text="WebSocket-сообщения, моментальная доставка через Realtime-канал." />
          <Feature icon={Lock} title="Роли" text="Гибкая система прав: пользователи и администраторы со своей зоной ответственности." />
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} UKA Messenger
      </footer>
    </main>
  );
}
