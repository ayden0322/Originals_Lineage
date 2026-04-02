/** 網站設定用的字體選項（標題 / 內文） */
export interface FontOption {
  label: string;
  value: string;
  /** Google Fonts 名稱（用來動態載入），null 表示系統字體 */
  googleName: string | null;
  category: string;
}

/** 網站設定 — 標題 + 內文字體選項 */
export const SITE_FONT_OPTIONS: FontOption[] = [
  // 系統字體
  { label: '系統預設', value: 'sans-serif', googleName: null, category: '系統字體' },
  { label: '系統襯線體', value: 'serif', googleName: null, category: '系統字體' },

  // Google Fonts — 中文
  { label: 'Noto Sans TC（思源黑體）', value: "'Noto Sans TC', sans-serif", googleName: 'Noto+Sans+TC', category: '中文字體' },
  { label: 'Noto Serif TC（思源宋體）', value: "'Noto Serif TC', serif", googleName: 'Noto+Serif+TC', category: '中文字體' },
  { label: '王漢宗隸書體', value: "'HanWangLiSuMedium', serif", googleName: null, category: '中文字體' },

  // Google Fonts — 英文襯線
  { label: 'Playfair Display', value: "'Playfair Display', serif", googleName: 'Playfair+Display', category: '英文襯線' },
  { label: 'Lora', value: "'Lora', serif", googleName: 'Lora', category: '英文襯線' },
  { label: 'Merriweather', value: "'Merriweather', serif", googleName: 'Merriweather', category: '英文襯線' },
  { label: 'Cormorant Garamond', value: "'Cormorant Garamond', serif", googleName: 'Cormorant+Garamond', category: '英文襯線' },

  // Google Fonts — 英文無襯線
  { label: 'Inter', value: "'Inter', sans-serif", googleName: 'Inter', category: '英文無襯線' },
  { label: 'Roboto', value: "'Roboto', sans-serif", googleName: 'Roboto', category: '英文無襯線' },
  { label: 'Montserrat', value: "'Montserrat', sans-serif", googleName: 'Montserrat', category: '英文無襯線' },
  { label: 'Raleway', value: "'Raleway', sans-serif", googleName: 'Raleway', category: '英文無襯線' },
  { label: 'Oswald', value: "'Oswald', sans-serif", googleName: 'Oswald', category: '英文無襯線' },

  // Google Fonts — 遊戲/裝飾風格
  { label: 'Cinzel', value: "'Cinzel', serif", googleName: 'Cinzel', category: '裝飾風格' },
  { label: 'Cinzel Decorative', value: "'Cinzel Decorative', serif", googleName: 'Cinzel+Decorative', category: '裝飾風格' },
];

/** 富文本編輯器 — 更多字體選項 */
export const EDITOR_FONT_OPTIONS: FontOption[] = [
  ...SITE_FONT_OPTIONS,
  // 額外的編輯器字體
  { label: 'Georgia', value: "'Georgia', serif", googleName: null, category: '系統字體' },
  { label: 'Times New Roman', value: "'Times New Roman', serif", googleName: null, category: '系統字體' },
  { label: 'Arial', value: "'Arial', sans-serif", googleName: null, category: '系統字體' },
  { label: 'Courier New', value: "'Courier New', monospace", googleName: null, category: '等寬字體' },
  { label: 'Microsoft JhengHei（微軟正黑體）', value: "'Microsoft JhengHei', sans-serif", googleName: null, category: '中文字體' },
  { label: 'PingFang TC（蘋方）', value: "'PingFang TC', sans-serif", googleName: null, category: '中文字體' },
  { label: 'Josefin Sans', value: "'Josefin Sans', sans-serif", googleName: 'Josefin+Sans', category: '英文無襯線' },
  { label: 'Fira Code', value: "'Fira Code', monospace", googleName: 'Fira+Code', category: '等寬字體' },
];

/** 從字體 value 中解析 Google Font 名稱 */
export function extractGoogleFontNames(fonts: (string | undefined)[]): string[] {
  const allOptions = [...SITE_FONT_OPTIONS, ...EDITOR_FONT_OPTIONS];
  const googleNames: string[] = [];
  const seen = new Set<string>();

  for (const fontValue of fonts) {
    if (!fontValue) continue;
    const opt = allOptions.find((o) => o.value === fontValue);
    if (opt?.googleName && !seen.has(opt.googleName)) {
      seen.add(opt.googleName);
      googleNames.push(opt.googleName);
    }
  }
  return googleNames;
}

/** 產生 Google Fonts CSS link URL */
export function buildGoogleFontsUrl(fontNames: string[]): string | null {
  if (fontNames.length === 0) return null;
  const families = fontNames.map((n) => `family=${n}:wght@300;400;500;600;700`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
