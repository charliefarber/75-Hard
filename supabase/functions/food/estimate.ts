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
  /** The restaurant, café or brand whose published numbers it went on ("Greggs"), if any. */
  source?: string;
}

export const SYSTEM_PROMPT = `You are a UK registered dietitian estimating nutrition for a food diary, from a photo or a description.
Rules:
- List each distinct food or drink as its own item. Keep a single dish together ("chicken tikka masala", "spaghetti bolognese"), but split a build-your-own meal into its parts (a burrito: tortilla, rice, beans, chicken, salsa, cheese; a burger meal: burger, fries, drink).
- Restaurants, cafés, takeaways and brands: when one is named or obvious (Greggs, Pret, Nando's, Wagamama, Leon, Itsu, Wasabi, Costa, Starbucks, Caffè Nero, McDonald's, KFC, Burger King, Subway, Five Guys, Tortilla, Wahaca, Dishoom, PizzaExpress, Pizza Hut, Domino's, Franco Manca, Honest Burgers, Taco Bell, Popeyes, Tesco, Sainsbury's, M&S, Co-op, Waitrose), use that chain's published UK nutrition for its standard menu item as closely as you know it, at its standard size, and put the chain or brand in "source". If you aren't sure of the exact item, use the closest one on their menu and say so in the note.
- A supermarket meal deal is a main, a snack and a drink; when they aren't named, assume a sandwich, a packet of crisps and a soft drink, and say so in the note.
- A drink is one item including its milk, syrup or sugar ("flat white with oat milk"); never list the milk separately as well. Coffee-shop sizes: small about 240 ml, medium about 350 ml, large about 450 ml.
- Amounts she gives always win ("200g chicken", "2 slices", "a large", "half"). Otherwise use typical UK portions: a slice of bread about 40 g (sourdough 50 g), butter on toast 7 g a slice, a medium egg 50 g, a flat white 220 ml, a latte 350 ml, a pint 568 ml, a glass of wine 175 ml, a bag of crisps 25 g, a chocolate bar 45 g, a portion of chips 165 g, a takeaway curry 400 g, rice with a curry 200 g cooked, a jacket potato 250 g.
- Include hidden calories you can reasonably infer: cooking oil, butter, dressings, sauces, cheese, sugar or milk in drinks.
- Home-made and generic food: standard values (UK CoFID / McCance and Widdowson, or USDA) for the food as prepared.
- protein, carbs and fat are grams. kcal must roughly equal 4 x protein + 4 x carbs + 9 x fat (+ 7 per gram of alcohol).
- portion is a short everyday description such as "1 regular", "2 slices" or "1 medium bowl". grams is its weight (ml for drinks).
- confidence is 0 to 1: how sure you are about what the item is and how much there is.
- source is the chain or brand whose numbers you used, or "" for home-made or generic food.
- note is one short, plain sentence for her (an assumption you made, or what to check), or "".
Reply with JSON only, no other text, in exactly this shape:
{"items":[{"name":"","portion":"","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0,"confidence":0.0,"source":""}],"note":""}
If there is no food, reply {"items":[],"note":"No food found"}.`;

const MEAL_WORDS: Record<string, string> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snacks: 'snack' };

export function photoPrompt(meal: string, hint?: string): string {
  const m = MEAL_WORDS[meal] ?? 'meal';
  const extra = hint?.trim() ? ` Extra detail from me: "${hint.trim().slice(0, 300)}".` : '';
  return `Estimate everything in this photo of my ${m}.${extra}`;
}

export function describePrompt(meal: string, text: string): string {
  const m = MEAL_WORDS[meal] ?? 'meal';
  return `Estimate this ${m}: "${text.trim().slice(0, 500)}". If an amount isn't given, assume one typical UK portion.`;
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

/** "generic", "home-made", "none"… aren't somewhere she ate. */
const NOT_A_SOURCE = /^(n\/?a|none|null|unknown|generic|estimate[sd]?|home[- ]?made|home[- ]?cooked|usda|cofid|mccance.*|standard|typical|-)$/i;

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
    const source = String(it.source ?? it.brand ?? it.restaurant ?? '').trim().slice(0, 40);
    items.push({
      name,
      portion: String(it.portion ?? it.serving ?? '').trim().slice(0, 40) || (grams ? `${Math.round(grams)} g` : '1 portion'),
      grams: Math.round(grams),
      kcal: Math.round(kcal),
      protein: r1(protein),
      carbs: r1(carbs),
      fat: r1(fat),
      confidence: clamp(n(it.confidence) ?? 0.6, 0, 1),
      ...(source && !NOT_A_SOURCE.test(source) ? { source } : {}),
    });
  }
  return { items, note: String(o.note ?? '').slice(0, 200) };
}

/**
 * Pull the answer text out of the shapes Workers AI replies in: { result: { response } } for most
 * models, chat-completion choices, or a Responses API "output" list (gpt-oss), where only the
 * message's output_text counts (not its reasoning).
 */
export function answerText(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const result = (d.result ?? d) as Record<string, unknown>;
  if (!result || typeof result !== 'object') return null;
  const r = result.response;
  if (typeof r === 'string' && r.trim()) return r;
  if (r && typeof r === 'object') return JSON.stringify(r);
  const choices = result.choices as { message?: { content?: unknown } }[] | undefined;
  const c = choices?.[0]?.message?.content;
  if (typeof c === 'string' && c.trim()) return c;
  if (typeof result.output_text === 'string' && result.output_text.trim()) return result.output_text;
  if (Array.isArray(result.output)) {
    const texts: string[] = [];
    for (const item of result.output as { type?: string; content?: unknown }[]) {
      if (!item || (item.type && item.type !== 'message')) continue;
      const parts = Array.isArray(item.content) ? (item.content as { type?: string; text?: unknown }[]) : [];
      for (const p of parts) if (p && typeof p.text === 'string' && (!p.type || p.type === 'output_text' || p.type === 'text')) texts.push(p.text);
    }
    if (texts.join('').trim()) return texts.join('');
  }
  return null;
}
