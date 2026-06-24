import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/join/$slug")({
  component: JoinView,
});

function JoinView() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("join_by_slug", { _slug: slug });
      if (error) {
        toast.error(error.message);
        navigate({ to: "/app" });
        return;
      }
      toast.success("Вы присоединились");
      navigate({ to: "/app/$conversationId", params: { conversationId: data as string } });
    })();
  }, [slug, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--neon-violet)]" />
    </div>
  );
}
