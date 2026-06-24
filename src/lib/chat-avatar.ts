import { supabase } from "@/integrations/supabase/client";

/** Uploads a chat avatar image and returns a 1-year signed URL. */
export async function uploadChatAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${userId}/chat-${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error || !data?.signedUrl) throw error ?? new Error("Не удалось получить ссылку");
  return data.signedUrl;
}
