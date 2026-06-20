import { useState } from "react";

const STICKER_CATEGORIES = [
  {
    label: "😀 Эмоции",
    stickers: [
      "😀","😂","🤣","😍","🥰","😎","🤩","😜","🤪","😏",
      "😢","😭","😤","😡","🥺","😳","🤯","😱","🥳","😴",
      "🤔","🤗","😇","🙃","😋","🤑","😏","😬","🤭","🫠",
    ],
  },
  {
    label: "👋 Жесты",
    stickers: [
      "👋","🤝","👍","👎","✌️","🤞","👌","🤟","🖐️","✋",
      "🤙","💪","🦾","🙏","👏","🤲","🫶","💅","🤌","🫵",
    ],
  },
  {
    label: "🐱 Животные",
    stickers: [
      "🐱","🐶","🐼","🐨","🦊","🐯","🦁","🐸","🐧","🦋",
      "🐬","🦄","🐉","🦅","🐙","🦑","🦕","🐢","🦎","🐓",
    ],
  },
  {
    label: "❤️ Сердца",
    stickers: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💕",
      "💞","💓","💗","💖","💝","💘","💟","❣️","💔","🫀",
    ],
  },
  {
    label: "🎉 Праздник",
    stickers: [
      "🎉","🎊","🎈","🎁","🥂","🎂","🍰","🎆","🎇","✨",
      "🎯","🏆","🥇","🎖️","🎗️","🪅","🎑","🎃","🎄","🎋",
    ],
  },
  {
    label: "💬 Реакции",
    stickers: [
      "👀","💯","🔥","⚡","💥","✅","❌","⁉️","‼️","🚀",
      "💎","🌟","⭐","🌈","☀️","🌙","🌊","🍀","🪄","🎭",
    ],
  },
];

interface StickerPickerProps {
  onSelect: (sticker: string) => void;
  onClose: () => void;
}

export function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="absolute bottom-full mb-2 left-0 z-50 w-72 glass-strong rounded-2xl border border-border/40 overflow-hidden shadow-[var(--shadow-neon)] animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Category tabs */}
      <div className="flex border-b border-border/30 overflow-x-auto">
        {STICKER_CATEGORIES.map((cat, i) => (
          <button
            key={i}
            onClick={() => setActiveCategory(i)}
            className={`px-3 py-2 text-lg shrink-0 transition hover:bg-white/5 ${
              activeCategory === i ? "border-b-2 border-[var(--neon-violet)]" : ""
            }`}
            title={cat.label}
          >
            {cat.stickers[0]}
          </button>
        ))}
      </div>

      {/* Sticker grid */}
      <div className="p-2 h-48 overflow-y-auto">
        <p className="text-[10px] text-muted-foreground mb-2 px-1">
          {STICKER_CATEGORIES[activeCategory].label}
        </p>
        <div className="grid grid-cols-6 gap-1">
          {STICKER_CATEGORIES[activeCategory].stickers.map((sticker, i) => (
            <button
              key={i}
              onClick={() => { onSelect(sticker); onClose(); }}
              className="text-2xl h-10 w-10 flex items-center justify-center rounded-lg hover:bg-white/10 transition hover:scale-125 active:scale-95"
            >
              {sticker}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
