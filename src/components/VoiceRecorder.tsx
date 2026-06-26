import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  conversationId: string;
  userId: string;
  onSent: () => void;
};

export function VoiceRecorder({ conversationId, userId, onSent }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "preview" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setState("preview");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRecRef.current = rec;
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= 300) {
            stop();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Нет доступа к микрофону");
    }
  }

  function stop() {
    mediaRecRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function cancel() {
    if (state === "recording") {
      mediaRecRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setSeconds(0);
    setState("idle");
  }

  async function send() {
    if (!blob) return;
    setState("uploading");
    try {
      const path = `${conversationId}/${userId}/${Date.now()}.webm`;
      const { error: upErr } = await supabase.storage
        .from("voice-messages")
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: `voice:${path}:${seconds}`,
      });
      if (insErr) throw insErr;
      cancel();
      onSent();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить аудио");
      setState("preview");
    }
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={start}
        title="Голосовое сообщение"
        className="h-11 w-11 shrink-0 rounded-xl glass hover:neon-ring flex items-center justify-center"
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 px-3 h-11 rounded-xl glass-strong neon-ring">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-mono tabular-nums text-foreground">{fmt(seconds)}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">запись…</span>
        <button
          type="button"
          onClick={cancel}
          title="Отменить"
          className="ml-1 h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={stop}
          title="Остановить"
          className="h-7 w-7 rounded-lg bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white flex items-center justify-center"
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      </div>
    );
  }

  // preview / uploading
  return (
    <div className="flex items-center gap-2 px-2 h-11 rounded-xl glass-strong">
      {previewUrl && <audio src={previewUrl} controls className="h-8 max-w-[180px]" />}
      <span className="text-xs font-mono text-muted-foreground">{fmt(seconds)}</span>
      <button
        type="button"
        onClick={cancel}
        disabled={state === "uploading"}
        title="Удалить"
        className="h-7 w-7 rounded-lg hover:bg-white/10 flex items-center justify-center disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <button
        type="button"
        onClick={send}
        disabled={state === "uploading"}
        title="Отправить"
        className="h-7 w-7 rounded-lg bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white flex items-center justify-center disabled:opacity-50"
      >
        {state === "uploading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
