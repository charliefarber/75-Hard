import { afterEach, describe, expect, it, vi } from 'vitest';
import { foodFromOff, lookupBarcode, searchProducts, validBarcode } from './off';

describe('barcodes', () => {
  it('checks the check digit', () => {
    expect(validBarcode('5000157024671')).toBe(true); // EAN-13
    expect(validBarcode('5000157024672')).toBe(false);
    expect(validBarcode('96385074')).toBe(true); // EAN-8
    expect(validBarcode('036000291452')).toBe(true); // UPC-A
    expect(validBarcode('12345')).toBe(false);
    expect(validBarcode('abcdefghijklm')).toBe(false);
  });
});

describe('Open Food Facts products', () => {
  it('reads a normal UK label', () => {
    const f = foodFromOff({
      code: '5000157024671',
      product_name: 'Baked Beanz',
      brands: 'Heinz, Kraft Heinz',
      quantity: '415 g',
      product_quantity: 415,
      serving_size: '1/2 can (207 g)',
      serving_quantity: 207,
      nutriments: { 'energy-kcal_100g': 78, proteins_100g: 4.7, carbohydrates_100g: 12.5, fat_100g: 0.2, fiber_100g: 3.7, sugars_100g: 4.7, salt_100g: 0.6 },
      image_front_small_url: 'https://images.openfoodfacts.org/images/products/500/015/702/4671/front_en.200.jpg',
    })!;
    expect(f).toMatchObject({ key: 'off:5000157024671', name: 'Baked Beanz', brand: 'Heinz', base: 'g', barcode: '5000157024671', defaultServing: 0 });
    expect(f.per100).toMatchObject({ kcal: 78, protein: 4.7, carbs: 12.5, fat: 0.2, salt: 0.6 });
    expect(f.servings).toEqual([
      { label: '1/2 can (207 g)', grams: 207 },
      { label: 'whole pack (415 g)', grams: 415 },
    ]);
    expect(f.image).toMatch(/^https:\/\/images\.openfoodfacts\.org\//);
  });

  it('works from kJ, and from per-serving numbers when there are no per-100 g ones', () => {
    const kj = foodFromOff({ code: '1', product_name: 'Oat drink', quantity: '1 l', nutriments: { energy_100g: 197, proteins_100g: 1, carbohydrates_100g: 6.6, fat_100g: 1.5 } })!;
    expect(kj.per100.kcal).toBe(47);
    expect(kj.base).toBe('ml');
    const serving = foodFromOff({ code: '2', product_name: 'Protein bar', serving_size: '60 g', serving_quantity: 60, nutriments: { 'energy-kcal_serving': 214, proteins_serving: 20 } })!;
    expect(serving.per100.kcal).toBe(357);
    expect(serving.per100.protein).toBeCloseTo(33.3, 1);
  });

  it('calls a bare weight a serving', () => {
    const f = foodFromOff({ code: '3', product_name: 'Yoghurt', serving_size: '170 g', serving_quantity: 170, nutriments: { 'energy-kcal_100g': 54 } })!;
    expect(f.servings[0]).toEqual({ label: '1 serving (170 g)', grams: 170 });
  });

  it('skips products without usable calories or a name, and images from elsewhere', () => {
    expect(foodFromOff({ code: '4', product_name: 'Mystery', nutriments: {} })).toBeNull();
    expect(foodFromOff({ code: '5', product_name: 'Broken', nutriments: { 'energy-kcal_100g': 4000 } })).toBeNull();
    expect(foodFromOff({ code: '6', nutriments: { 'energy-kcal_100g': 100 } })).toBeNull();
    const f = foodFromOff({ code: '7', product_name: 'Crisps', nutriments: { 'energy-kcal_100g': 530 }, image_front_small_url: 'https://evil.example/x.jpg' })!;
    expect(f.image).toBeUndefined();
  });

  it('takes the English name when there are several', () => {
    const f = foodFromOff({ code: '8', product_name: { fr: 'Pain', en: 'Bread' }, nutriments: { 'energy-kcal_100g': 250 } })!;
    expect(f.name).toBe('Bread');
  });
});

describe('network fallbacks', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the server proxy when the phone can’t reach Open Food Facts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const proxy = vi.fn().mockResolvedValue({ status: 1, product: { product_name: 'Weetabix', nutriments: { 'energy-kcal_100g': 362 } } });
    const f = await lookupBarcode('5010029000061', proxy);
    expect(proxy).toHaveBeenCalledWith('product', { code: '5010029000061' });
    expect(f?.name).toBe('Weetabix');
  });

  it('treats a 404 as "not found" without bothering the proxy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":0}', { status: 404 })));
    const proxy = vi.fn();
    expect(await lookupBarcode('5000000000002', proxy)).toBeNull();
    expect(proxy).not.toHaveBeenCalled();
  });

  it('searches, and de-duplicates products', async () => {
    const hit = { code: '9', product_name: 'Skyr', nutriments: { 'energy-kcal_100g': 63 } };
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ hits: [hit, hit, { code: '10', product_name: 'No calories' }] }), { status: 200 })));
    const foods = await searchProducts('skyr natural');
    expect(foods.map((f) => f.key)).toEqual(['off:9']);
  });
});
