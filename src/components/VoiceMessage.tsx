import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  path: string;
  duration: number;
  mine: boolean;
};

// in-memory cache for signed URLs (1h ttl)
const urlCache = new Map<string, { url: string; exp: number }>();

async function getSignedUrl(path: string) {
  const cached = urlCache.get(path);
  if (cached && cached.exp > Date.now()) return cached.url;
  const { data } = await supabase.storage.from("voice-messages").createSignedUrl(path, 3600);
  if (data?.signedUrl) {
    urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 55 * 60_000 });
    return data.signedUrl;
  }
  return null;
}

export function VoiceMessage({ path, duration, mine }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    getSignedUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);

  async function toggle() {
    if (!url) return;
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      try {
        await a.play();
      } catch {
        /* ignore */
      }
    }
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const bars = Array.from({ length: 28 }, (_, i) => {
    // pseudo-random waveform deterministic by index
    const h = 30 + ((Math.sin(i * 1.7) + 1) * 35 + (i % 5) * 4);
    return Math.min(95, h);
  });

  const playedBars = Math.round(bars.length * progress);

  return (
    <div
      className={`flex items-center gap-2.5 min-w-[200px] max-w-[280px] rounded-2xl px-3 py-2 ${
        mine
          ? "bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-blue)] text-white shadow-[var(--shadow-neon)]"
          : "glass"
      }`}
    >
      <button
        onClick={toggle}
        disabled={!url}
        className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition ${
          mine ? "bg-white/20 hover:bg-white/30" : "bg-white/10 hover:bg-white/20"
        } disabled:opacity-50`}
      >
        {!url ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-[2px] h-7">
          {bars.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                i < playedBars
                  ? mine
                    ? "bg-white"
                    : "bg-[var(--neon-cyan)]"
                  : mine
                    ? "bg-white/40"
                    : "bg-foreground/30"
              }`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className={`mt-0.5 text-[10px] font-mono tabular-nums ${mine ? "text-white/80" : "text-muted-foreground"}`}>
          {playing || current > 0 ? fmt(current) : fmt(duration)}
        </div>
      </div>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
            setCurrent(0);
          }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            const d = a.duration || duration || 1;
            setProgress(a.currentTime / d);
            setCurrent(a.currentTime);
          }}
        />
      )}
    </div>
  );
}
