import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  status_text: string | null;
  status_emoji: string | null;
  country: string | null;
  phone: string | null;
};

export function UserProfileDialog({
  userId,
  open,
  onOpenChange,
  showMessageButton = true,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  showMessageButton?: boolean;
}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, first_name, last_name, username, avatar_url, status_text, status_emoji, country, phone",
          )
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("[UserProfileDialog] load error", error);
          toast.error(error.message);
        }
        setProfile((data as Profile | null) ?? null);
      } catch (e) {
        if (!cancelled) console.error("[UserProfileDialog] exception", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, open]);

  async function startDirect() {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_or_create_direct", { _other: userId });
    if (error) {
      toast.error(error.message);
      return;
    }
    onOpenChange(false);
    navigate({ to: "/app/$conversationId", params: { conversationId: data as string } });
  }

  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() || "?";
  const fullName = `${profile?.last_name ?? ""} ${profile?.first_name ?? ""}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/40 max-w-sm">
        <DialogHeader>
          <DialogTitle>Профиль</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !profile ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Профиль недоступен или скрыт настройками приватности.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-3 pt-2">
              <Avatar className="h-24 w-24 ring-2 ring-[var(--neon-violet)]/60">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-lg font-bold">{fullName || `@${profile.username}`}</div>
                {profile.username && (
                  <div className="text-sm text-muted-foreground">@{profile.username}</div>
                )}
                {profile.status_text && (
                  <div className="text-sm mt-1">
                    {profile.status_emoji} {profile.status_text}
                  </div>
                )}
              </div>
            </div>
            {(profile.country || profile.phone) && (
              <div className="glass rounded-lg p-3 text-sm space-y-1">
                {profile.country && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Страна</span>
                    <span>{profile.country}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Телефон</span>
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>
            )}
            {showMessageButton && (
              <Button
                onClick={startDirect}
                className="w-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] text-white"
              >
                <MessageSquare className="h-4 w-4 mr-2" /> Написать
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
