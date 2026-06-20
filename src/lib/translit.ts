// Uzbek/Russian cyrillic <-> latin converter (heuristic, instant, client-side)
const cyrToLat: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ғ: "gʻ",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  қ: "q",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  ў: "oʻ",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "x",
  ҳ: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "ʼ",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const latToCyr: Array<[string, string]> = [
  ["sh", "ш"],
  ["ch", "ч"],
  ["ya", "я"],
  ["yu", "ю"],
  ["yo", "ё"],
  ["ts", "ц"],
  ["gʻ", "ғ"],
  ["g'", "ғ"],
  ["oʻ", "ў"],
  ["o'", "ў"],
  ["a", "а"],
  ["b", "б"],
  ["v", "в"],
  ["g", "г"],
  ["d", "д"],
  ["e", "е"],
  ["j", "ж"],
  ["z", "з"],
  ["i", "и"],
  ["y", "й"],
  ["k", "к"],
  ["q", "қ"],
  ["l", "л"],
  ["m", "м"],
  ["n", "н"],
  ["o", "о"],
  ["p", "п"],
  ["r", "р"],
  ["s", "с"],
  ["t", "т"],
  ["u", "у"],
  ["f", "ф"],
  ["x", "х"],
  ["h", "ҳ"],
  ["ʼ", "ъ"],
  ["ʻ", ""],
  ["'", ""],
];

function preserveCase(src: string, out: string) {
  if (!src) return out;
  if (src === src.toUpperCase()) return out.toUpperCase();
  if (src[0] === src[0].toUpperCase()) return out[0]?.toUpperCase() + out.slice(1);
  return out;
}

export function isCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

export function toLatin(text: string): string {
  return text
    .split("")
    .map((ch) => {
      const lower = ch.toLowerCase();
      const mapped = cyrToLat[lower];
      if (mapped == null) return ch;
      return preserveCase(ch, mapped);
    })
    .join("");
}

export function toCyrillic(text: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const [lat, cyr] of latToCyr) {
      const slice = text.slice(i, i + lat.length);
      if (slice.toLowerCase() === lat) {
        result += preserveCase(slice, cyr);
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += text[i];
      i++;
    }
  }
  return result;
}

export function convertScript(text: string): string {
  return isCyrillic(text) ? toLatin(text) : toCyrillic(text);
}
