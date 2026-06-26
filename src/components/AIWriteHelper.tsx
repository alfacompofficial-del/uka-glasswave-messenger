import { useState } from "react";
import { Sparkles, Wand2, FileText, Briefcase, Zap, Heart, Loader2 } from "lucide-react";
import { improveText } from "@/lib/ai.functions";
import { toast } from "sonner";

type Mode = "fix" | "detailed" | "formal" | "quick" | "friendly";

const MODES: { key: Mode; label: string; icon: typeof Wand2; hint: string }[] = [
  { key: "fix", label: "Исправить", icon: Wand2, hint: "Грамотный текст без ошибок" },
  { key: "detailed", label: "Подробно", icon: FileText, hint: "Развёрнуто и понятно" },
  { key: "formal", label: "Формально", icon: Briefcase, hint: "Деловой стиль" },
  { key: "quick", label: "По-быстрому", icon: Zap, hint: "Коротко по-телеграмному" },
  { key: "friendly", label: "Дружески", icon: Heart, hint: "Тёплый живой тон" },
];

export function AIWriteHelper({
  text,
  onApply,
  onClose,
}: {
  text: string;
  onApply: (newText: string) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<Mode | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function run(mode: Mode) {
    if (!text.trim()) {
      toast.error("Сначала введите текст для обработки");
      return;
    }
    setLoading(mode);
    setPreview(null);
    try {
      const res = await improveText({ data: { text, mode } });
      setPreview(res.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="absolute bottom-full mb-2 right-0 w-[340px] glass-strong rounded-2xl border border-border/40 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Sparkles className="h-4 w-4 text-[var(--neon-violet)]" />
        <span className="text-sm font-semibold">AI-помощник</span>
        <button
          onClick={onClose}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Закрыть
        </button>
      </div>

      {!text.trim() && (
        <div className="text-xs text-muted-foreground px-1 pb-2">
          Введите текст в поле ниже, затем выберите стиль.
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isLoading = loading === m.key;
          return (
            <button
              key={m.key}
              onClick={() => run(m.key)}
              disabled={loading !== null}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg glass hover:neon-ring text-left transition disabled:opacity-50 disabled:cursor-wait"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--neon-cyan)]" />
              ) : (
                <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--neon-cyan)]" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium leading-tight">{m.label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight truncate">
                  {m.hint}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {preview && (
        <div className="mt-3 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">
            Предпросмотр
          </div>
          <div className="text-sm whitespace-pre-wrap break-words p-2.5 rounded-lg bg-white/5 border border-border/30 max-h-40 overflow-y-auto">
            {preview}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onApply(preview);
                onClose();
              }}
              className="flex-1 h-8 rounded-lg bg-gradient-to-r from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white text-xs font-semibold hover:scale-[1.02] transition"
            >
              Использовать
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-3 h-8 rounded-lg glass text-xs"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
