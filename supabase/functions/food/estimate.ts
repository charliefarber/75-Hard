// Prompt + answer parsing for photo / description calorie estimates.
// Plain TypeScript (no Deno or browser APIs) so the app's tests can check it too.

export interface EstimatedItem {
  name: string;
  portion: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
}

export const SYSTEM_PROMPT = `You are a registered dietitian estimating nutrition for a food diary, from a photo or a description.
Rules:
- List each distinct food or drink as its own item (e.g. "grilled chicken breast", "white rice", "olive oil dressing"). Keep a single dish together (e.g. "chicken tikka masala").
- Estimate the amount actually there, in grams (ml for drinks). Use cues: a dinner plate is about 26 cm across, a fork about 19 cm, a mug about 350 ml.
- Include hidden calories you can reasonably infer: cooking oil, butter, dressings, sauces, cheese, sugar or milk in drinks.
- Use standard nutrition values (USDA / UK food tables) for the food as prepared.
- protein, carbs and fat are grams. kcal must roughly equal 4 x protein + 4 x carbs + 9 x fat (+ 7 per gram of alcohol).
- portion is a short everyday description such as "1 cup", "2 slices" or "1 medium bowl".
- confidence is 0 to 1: how sure you are about what the item is and how much there is.
Reply with JSON only, no other text, in exactly this shape:
{"items":[{"name":"","portion":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"confidence":0.0}],"note":""}
If there is no food, reply {"items":[],"note":"No food found"}.`;

const MEAL_WORDS: Record<string, string> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snacks: 'snack' };

export function photoPrompt(meal: string, hint?: string): string {
  const m = MEAL_WORDS[meal] ?? 'meal';
  const extra = hint?.trim() ? ` Extra detail from me: "${hint.trim().slice(0, 300)}".` : '';
  return `Estimate everything in this photo of my ${m}.${extra}`;
}

export function describePrompt(meal: string, text: string): string {
  const m = MEAL_WORDS[meal] ?? 'meal';
  return `Estimate this ${m}: "${text.trim().slice(0, 500)}". If an amount isn't given, assume one typical portion.`;
}

const n = (v: unknown): number | null => {
  const x = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(x) ? x : null;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** The first JSON object in a model's answer (models sometimes wrap it in prose or code fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const raw = text.slice(start, end + 1);
  try {
    return JSON.parse(raw);
  } catch {
    try {
      // trailing commas, smart quotes
      return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"'));
    } catch {
      return null;
    }
  }
}

/** Clean, bounded items from whatever the model sent back (or null if it isn't usable). */
export function parseEstimate(answer: unknown): { items: EstimatedItem[]; note: string } | null {
  const data = typeof answer === 'string' ? extractJson(answer) : answer;
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const list = Array.isArray(o.items) ? o.items : Array.isArray(o.foods) ? o.foods : Array.isArray(data) ? (data as unknown[]) : null;
  if (!list) return null;
  const items: EstimatedItem[] = [];
  for (const raw of list.slice(0, 15)) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as Record<string, unknown>;
    const name = String(it.name ?? it.food ?? '').trim().slice(0, 80);
    if (!name) continue;
    const protein = clamp(n(it.protein ?? it.protein_g) ?? 0, 0, 500);
    const carbs = clamp(n(it.carbs ?? it.carbohydrates ?? it.carbs_g) ?? 0, 0, 800);
    const fat = clamp(n(it.fat ?? it.fat_g) ?? 0, 0, 400);
    const fromMacros = 4 * protein + 4 * carbs + 9 * fat;
    let kcal = n(it.kcal ?? it.calories ?? it.energy);
    if (kcal == null || kcal <= 0) kcal = fromMacros;
    kcal = clamp(kcal, 0, 5000);
    if (kcal === 0 && fromMacros === 0) continue;
    const grams = clamp(n(it.grams ?? it.weight_g ?? it.amount_g) ?? 0, 0, 3000);
    items.push({
      name,
      portion: String(it.portion ?? it.serving ?? '').trim().slice(0, 40) || (grams ? `${Math.round(grams)} g` : '1 portion'),
      grams: Math.round(grams),
      kcal: Math.round(kcal),
      protein: r1(protein),
      carbs: r1(carbs),
      fat: r1(fat),
      confidence: clamp(n(it.confidence) ?? 0.6, 0, 1),
    });
  }
  return { items, note: String(o.note ?? '').slice(0, 200) };
}

/** Pull the text out of the shapes Workers AI answers in. */
export function answerText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const result = (d.result ?? d) as Record<string, unknown>;
  const r = result.response;
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object') return JSON.stringify(r);
  const choices = result.choices as { message?: { content?: unknown } }[] | undefined;
  const c = choices?.[0]?.message?.content;
  if (typeof c === 'string') return c;
  return null;
}
