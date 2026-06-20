import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center glass rounded-2xl px-12 py-10">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[var(--neon-violet)] to-[var(--neon-cyan)] flex items-center justify-center pulse-neon">
          <MessageSquare className="h-8 w-8 text-white" />
        </div>
        <h2 className="mt-4 text-xl font-bold">Выберите чат</h2>
        <p className="mt-1 text-sm text-muted-foreground">Чтобы начать общение, выберите чат слева или создайте новый</p>
      </div>
    </div>
  ),
});
