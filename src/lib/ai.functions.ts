import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const ModeSchema = z.enum(["fix", "detailed", "formal", "quick", "friendly"]);

const InputSchema = z.object({
  text: z.string().min(1).max(4000),
  mode: ModeSchema,
});

const PROMPTS: Record<z.infer<typeof ModeSchema>, string> = {
  fix: "Исправь орфографические, пунктуационные и грамматические ошибки в тексте пользователя. Сохрани смысл, тон и язык оригинала. Не добавляй ничего от себя. Верни только исправленный текст без пояснений и кавычек.",
  detailed:
    "Перепиши сообщение пользователя подробнее: добавь контекст, уточняющие детали и вежливые формулировки. Сохрани язык оригинала и основной смысл. Верни только новый текст без пояснений.",
  formal:
    "Перепиши сообщение пользователя в формальном деловом стиле, корректно и уважительно. Сохрани язык оригинала и смысл. Верни только новый текст без пояснений.",
  quick:
    "Сократи сообщение пользователя до максимально короткой и понятной формы, в дружеском мессенджер-стиле. Сохрани язык оригинала и главное содержание. Верни только новый текст без пояснений.",
  friendly:
    "Перепиши сообщение пользователя в тёплом дружеском тоне, естественно и живо. Сохрани язык оригинала и смысл. Верни только новый текст без пояснений.",
};

export const improveText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI помощник недоступен: ключ не настроен");

    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    try {
      const { text } = await generateText({
        // Provider/SDK type-version mismatch between @ai-sdk/openai-compatible
        // and ai@6 — runtime contract is identical.
        model: gateway("google/gemini-3-flash-preview") as never,
        system: PROMPTS[data.mode],
        prompt: data.text,
      });
      return { text: text.trim() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) throw new Error("Слишком часто. Попробуйте через минуту.");
      if (msg.includes("402"))
        throw new Error("Закончились AI-кредиты в рабочем пространстве.");
      throw new Error("Не удалось обработать текст: " + msg);
    }
  });
