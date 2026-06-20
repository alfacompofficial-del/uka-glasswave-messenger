export function validateUsername(value: string): string | null {
  if (!value) return "Юзернейм обязателен";
  if (value.length < 5 || value.length > 32) return "От 5 до 32 символов";
  if (!/^[A-Za-z0-9_]+$/.test(value)) return "Только латиница, цифры и _";
  if (!/^[A-Za-z]/.test(value)) return "Должен начинаться с буквы";
  if (value.startsWith("_") || value.endsWith("_"))
    return "Не может начинаться или заканчиваться на _";
  if (value.includes("__")) return "Двойное подчёркивание запрещено";
  return null;
}

export function validateName(value: string): string | null {
  if (!value.trim()) return "Поле обязательно";
  if (value.length > 64) return "Максимум 64 символа";
  return null;
}
