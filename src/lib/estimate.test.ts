import { describe, expect, it } from 'vitest';
import { answerText, describePrompt, extractJson, parseEstimate, photoPrompt } from '../../supabase/functions/food/estimate';

describe('estimate answers', () => {
  it('finds the JSON inside prose and code fences, forgiving trailing commas and smart quotes', () => {
    expect(extractJson('Sure! ```json\n{"items": [], "note": "ok"}\n```')).toEqual({ items: [], note: 'ok' });
    expect(extractJson('{“items”: [{"name": "Egg",}],}')).toEqual({ items: [{ name: 'Egg' }] });
    expect(extractJson('no json here')).toBeNull();
  });

  it('cleans and bounds what the model sends back', () => {
    const r = parseEstimate(
      JSON.stringify({
        items: [
          { name: 'Spaghetti bolognese', portion: '1 plate', grams: '350', kcal: 520, protein: 28, carbs: 62, fat: 16, confidence: 0.8 },
          { food: 'Parmesan', grams: 10, protein_g: 3.6, carbohydrates: 0.4, fat_g: 2.9 }, // no kcal: from macros
          { name: '', kcal: 100 },
          { name: 'Air', kcal: 0 },
          { name: 'Huge', kcal: 99999, grams: 99999, protein: 9999 },
        ],
        note: 'Portion looks large',
      }),
    )!;
    expect(r.note).toBe('Portion looks large');
    expect(r.items.map((i) => i.name)).toEqual(['Spaghetti bolognese', 'Parmesan', 'Huge']);
    expect(r.items[0]).toMatchObject({ grams: 350, kcal: 520, portion: '1 plate', confidence: 0.8 });
    expect(r.items[1]).toMatchObject({ kcal: 42, portion: '10 g', confidence: 0.6 });
    expect(r.items[2]).toMatchObject({ kcal: 5000, grams: 3000, protein: 500 });
  });

  it('accepts a bare list, and rejects nonsense', () => {
    expect(parseEstimate([{ name: 'Apple', kcal: 95 }])?.items).toHaveLength(1);
    expect(parseEstimate('I can’t see any food')).toBeNull();
    expect(parseEstimate({ items: [] })).toEqual({ items: [], note: '' });
  });

  it('reads the answer out of the shapes Workers AI uses', () => {
    expect(answerText({ result: { response: '{"items":[]}' } })).toBe('{"items":[]}');
    expect(answerText({ result: { response: { items: [] } } })).toBe('{"items":[]}');
    expect(answerText({ choices: [{ message: { content: 'hi' } }] })).toBe('hi');
    expect(answerText(null)).toBeNull();
  });

  it('prompts mention the meal and her words', () => {
    expect(photoPrompt('lunch')).toContain('lunch');
    expect(describePrompt('dinner', 'two slices of pepperoni pizza')).toContain('two slices of pepperoni pizza');
  });
});
