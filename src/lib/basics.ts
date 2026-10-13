import type { Food, Nutrition, Serving } from '../data/foodTypes';

/**
 * Everyday foods that work without a barcode, per 100 g (or 100 ml for drinks).
 * Values follow USDA FoodData Central and UK supermarket averages; packaged products come
 * from Open Food Facts instead, where the label is the source.
 */

type S = [label: string, grams: number];

const B = (
  id: string,
  name: string,
  [kcal, protein, carbs, fat, fiber, sugar]: [number, number, number, number, number?, number?],
  servings: S[],
  opts: { ml?: boolean; also?: string } = {},
): Food & { also?: string } => {
  const base = opts.ml ? 'ml' : 'g';
  const per100: Nutrition = { kcal, protein, carbs, fat, fiber: fiber ?? null, sugar: sugar ?? null };
  return {
    key: `basic:${id}`,
    name,
    source: 'basic',
    per100,
    base,
    servings: servings.map(([label, grams]): Serving => ({ label: `${label} (${grams} ${base})`, grams })),
    defaultServing: servings.length ? 0 : undefined,
    also: opts.also,
  };
};

export const BASICS: (Food & { also?: string })[] = [
  // Fruit
  B('apple', 'Apple', [52, 0.3, 13.8, 0.2, 2.4, 10.4], [['1 medium', 182], ['1 small', 149]]),
  B('banana', 'Banana', [89, 1.1, 22.8, 0.3, 2.6, 12.2], [['1 medium', 118], ['1 small', 101], ['1 large', 136]]),
  B('orange', 'Orange', [47, 0.9, 11.8, 0.1, 2.4, 9.4], [['1 medium', 131]]),
  B('clementine', 'Clementine / satsuma', [47, 0.9, 12.0, 0.2, 1.7, 9.2], [['1 fruit', 74]], { also: 'mandarin tangerine easy peeler' }),
  B('grapes', 'Grapes', [69, 0.7, 18.1, 0.2, 0.9, 15.5], [['handful', 80], ['1 cup', 151]]),
  B('strawberries', 'Strawberries', [32, 0.7, 7.7, 0.3, 2.0, 4.9], [['handful', 80], ['1 cup', 152]]),
  B('blueberries', 'Blueberries', [57, 0.7, 14.5, 0.3, 2.4, 10.0], [['handful', 80], ['1 cup', 148]]),
  B('raspberries', 'Raspberries', [52, 1.2, 11.9, 0.7, 6.5, 4.4], [['handful', 80], ['1 cup', 123]]),
  B('blackberries', 'Blackberries', [43, 1.4, 9.6, 0.5, 5.3, 4.9], [['handful', 80]]),
  B('pear', 'Pear', [57, 0.4, 15.2, 0.1, 3.1, 9.8], [['1 medium', 178]]),
  B('peach', 'Peach', [39, 0.9, 9.5, 0.3, 1.5, 8.4], [['1 medium', 150]]),
  B('nectarine', 'Nectarine', [44, 1.1, 10.6, 0.3, 1.7, 7.9], [['1 medium', 142]]),
  B('plum', 'Plum', [46, 0.7, 11.4, 0.3, 1.4, 9.9], [['1 plum', 66]]),
  B('mango', 'Mango', [60, 0.8, 15.0, 0.4, 1.6, 13.7], [['1 cup sliced', 165], ['½ mango', 100]]),
  B('pineapple', 'Pineapple', [50, 0.5, 13.1, 0.1, 1.4, 9.9], [['1 cup chunks', 165], ['1 slice', 80]]),
  B('watermelon', 'Watermelon', [30, 0.6, 7.6, 0.2, 0.4, 6.2], [['1 cup diced', 152], ['1 wedge', 280]]),
  B('melon', 'Melon (cantaloupe)', [34, 0.8, 8.2, 0.2, 0.9, 7.9], [['1 cup diced', 160]], { also: 'honeydew galia' }),
  B('kiwi', 'Kiwi', [61, 1.1, 14.7, 0.5, 3.0, 9.0], [['1 fruit', 69]]),
  B('avocado', 'Avocado', [160, 2.0, 8.5, 14.7, 6.7, 0.7], [['½ avocado', 75], ['1 avocado', 150]]),
  B('cherries', 'Cherries', [63, 1.1, 16.0, 0.2, 2.1, 12.8], [['handful', 80]]),
  B('pomegranate', 'Pomegranate seeds', [83, 1.7, 18.7, 1.2, 4.0, 13.7], [['½ cup', 87]]),
  B('grapefruit', 'Grapefruit', [42, 0.8, 10.7, 0.1, 1.6, 6.9], [['½ grapefruit', 123]]),
  B('dates', 'Medjool dates', [277, 1.8, 75.0, 0.2, 6.7, 66.5], [['1 date', 24]]),
  B('raisins', 'Raisins', [299, 3.1, 79.2, 0.5, 3.7, 59.2], [['1 tbsp', 10], ['small box', 14], ['handful', 30]], { also: 'sultanas' }),
  B('apricot', 'Apricot', [48, 1.4, 11.1, 0.4, 2.0, 9.2], [['1 fruit', 35]]),

  // Vegetables
  B('broccoli', 'Broccoli', [34, 2.8, 6.6, 0.4, 2.6, 1.7], [['portion', 80], ['1 cup', 91]], { also: 'tenderstem' }),
  B('spinach', 'Spinach', [23, 2.9, 3.6, 0.4, 2.2, 0.4], [['handful', 30], ['portion', 80]]),
  B('carrot', 'Carrot', [41, 0.9, 9.6, 0.2, 2.8, 4.7], [['1 medium', 61], ['portion', 80]]),
  B('tomato', 'Tomato', [18, 0.9, 3.9, 0.2, 1.2, 2.6], [['1 medium', 123], ['1 cherry tomato', 17]], { also: 'cherry tomatoes' }),
  B('cucumber', 'Cucumber', [15, 0.7, 3.6, 0.1, 0.5, 1.7], [['portion', 80], ['¼ cucumber', 75]]),
  B('salad', 'Mixed salad leaves', [15, 1.4, 2.9, 0.2, 1.3, 0.8], [['bowl', 50], ['handful', 25]], { also: 'lettuce greens rocket' }),
  B('pepper', 'Pepper (red)', [31, 1.0, 6.0, 0.3, 2.1, 4.2], [['1 medium', 119], ['½ pepper', 60]], { also: 'bell pepper capsicum' }),
  B('onion', 'Onion', [40, 1.1, 9.3, 0.1, 1.7, 4.2], [['1 medium', 110]]),
  B('mushrooms', 'Mushrooms', [22, 3.1, 3.3, 0.3, 1.0, 2.0], [['portion', 80]]),
  B('courgette', 'Courgette', [17, 1.2, 3.1, 0.3, 1.0, 2.5], [['1 medium', 196], ['portion', 80]], { also: 'zucchini' }),
  B('sweet_potato', 'Sweet potato (baked)', [90, 2.0, 20.7, 0.2, 3.3, 6.5], [['1 medium', 114], ['1 large', 180]]),
  B('potato_baked', 'Potato (baked)', [93, 2.5, 21.2, 0.1, 2.2, 1.2], [['1 medium', 173], ['1 large', 299]], { also: 'jacket potato' }),
  B('potato_boiled', 'Potatoes (boiled)', [87, 1.9, 20.1, 0.1, 1.8, 0.9], [['portion', 150]], { also: 'new potatoes' }),
  B('mash', 'Mashed potato', [113, 1.9, 16.8, 4.2, 1.5, 1.4], [['portion', 150]]),
  B('fries', 'Chips / fries', [312, 3.4, 41.4, 14.7, 3.8, 0.3], [['medium portion', 115], ['large portion', 155]], { also: 'french fries' }),
  B('peas', 'Peas', [81, 5.4, 14.5, 0.4, 5.1, 5.7], [['portion', 80]]),
  B('green_beans', 'Green beans', [31, 1.8, 7.0, 0.2, 2.7, 3.3], [['portion', 80]]),
  B('sweetcorn', 'Sweetcorn', [86, 3.3, 18.7, 1.4, 2.0, 6.3], [['portion', 80], ['1 cob', 100]], { also: 'corn' }),
  B('cauliflower', 'Cauliflower', [25, 1.9, 5.0, 0.3, 2.0, 1.9], [['portion', 80]]),
  B('asparagus', 'Asparagus', [20, 2.2, 3.9, 0.1, 2.1, 1.9], [['5 spears', 80]]),
  B('kale', 'Kale', [35, 2.9, 4.4, 1.5, 4.1, 1.0], [['handful', 30], ['portion', 80]]),
  B('cabbage', 'Cabbage', [25, 1.3, 5.8, 0.1, 2.5, 3.2], [['portion', 80]]),
  B('sprouts', 'Brussels sprouts', [43, 3.4, 9.0, 0.3, 3.8, 2.2], [['portion', 80]]),
  B('celery', 'Celery', [14, 0.7, 3.0, 0.2, 1.6, 1.3], [['1 stick', 40]]),
  B('beetroot', 'Beetroot (cooked)', [44, 1.7, 10.0, 0.2, 2.0, 8.0], [['portion', 80]]),
  B('edamame', 'Edamame', [121, 11.9, 8.9, 5.2, 5.2, 2.2], [['½ cup', 75]], { also: 'soy beans' }),
  B('aubergine', 'Aubergine', [25, 1.0, 5.9, 0.2, 3.0, 3.5], [['portion', 80]], { also: 'eggplant' }),
  B('squash', 'Butternut squash', [45, 1.0, 11.7, 0.1, 2.0, 2.2], [['portion', 80]]),

  // Grains, bread & cereal
  B('rice_white', 'Rice (white, cooked)', [130, 2.7, 28.2, 0.3, 0.4, 0.1], [['portion', 180], ['1 cup', 158]], { also: 'basmati jasmine' }),
  B('rice_brown', 'Rice (brown, cooked)', [123, 2.7, 25.6, 1.0, 1.6, 0.2], [['portion', 180], ['1 cup', 195]]),
  B('pasta', 'Pasta (cooked)', [158, 5.8, 30.9, 0.9, 1.8, 0.6], [['portion', 200], ['1 cup', 140]], { also: 'spaghetti penne fusilli' }),
  B('pasta_dry', 'Pasta (dry)', [371, 13.0, 74.7, 1.5, 3.2, 2.7], [['portion', 75]]),
  B('pasta_wholewheat', 'Wholewheat pasta (cooked)', [124, 5.3, 26.5, 0.5, 4.5, 0.8], [['portion', 200]]),
  B('oats', 'Oats', [379, 13.2, 67.7, 6.5, 10.1, 1.0], [['serving', 40], ['½ cup', 40]], { also: 'porridge oats rolled' }),
  B('porridge_water', 'Porridge (made with water)', [71, 2.5, 12.0, 1.5, 1.7, 0.3], [['bowl', 240]], { also: 'oatmeal' }),
  B('porridge_milk', 'Porridge (made with semi-skimmed milk)', [96, 4.8, 13.5, 2.4, 1.4, 4.1], [['bowl', 290]], { also: 'oatmeal' }),
  B('bread_white', 'Bread (white)', [265, 9.0, 49.0, 3.2, 2.7, 5.0], [['1 slice', 36], ['2 slices', 72]], { also: 'toast' }),
  B('bread_wholemeal', 'Bread (wholemeal)', [252, 12.5, 42.7, 3.5, 6.0, 4.4], [['1 slice', 36], ['2 slices', 72]], { also: 'brown whole wheat toast' }),
  B('sourdough', 'Sourdough', [260, 9.5, 51.0, 1.6, 2.5, 1.5], [['1 slice', 50]], { also: 'toast' }),
  B('bagel', 'Bagel (plain)', [257, 10.0, 50.0, 1.6, 2.2, 5.0], [['1 bagel', 90]]),
  B('wrap', 'Wrap / tortilla (flour)', [310, 8.3, 51.0, 7.9, 3.5, 3.0], [['1 wrap', 62]]),
  B('pitta', 'Pitta bread', [275, 9.1, 55.7, 1.2, 2.2, 1.3], [['1 pitta', 60]], { also: 'pita' }),
  B('naan', 'Naan bread', [291, 9.6, 50.4, 5.7, 2.2, 3.2], [['1 naan', 90]]),
  B('quinoa', 'Quinoa (cooked)', [120, 4.4, 21.3, 1.9, 2.8, 0.9], [['portion', 150], ['1 cup', 185]]),
  B('couscous', 'Couscous (cooked)', [112, 3.8, 23.2, 0.2, 1.4, 0.1], [['portion', 150]]),
  B('noodles_egg', 'Egg noodles (cooked)', [138, 4.5, 25.2, 2.1, 1.2, 0.4], [['portion', 160]]),
  B('noodles_rice', 'Rice noodles (cooked)', [108, 1.8, 24.0, 0.2, 1.0, 0.0], [['portion', 175]]),
  B('granola', 'Granola', [450, 10.0, 64.0, 17.0, 6.0, 20.0], [['serving', 45]]),
  B('cornflakes', 'Cornflakes', [357, 7.5, 84.1, 0.4, 3.3, 9.5], [['bowl', 30]], { also: 'cereal' }),
  B('muesli', 'Muesli', [360, 9.8, 66.0, 6.0, 7.6, 22.0], [['serving', 45]], { also: 'cereal' }),
  B('rice_cake', 'Rice cake', [387, 8.2, 81.5, 2.8, 4.2, 0.9], [['1 cake', 9]]),
  B('croissant', 'Croissant', [406, 8.2, 45.8, 21.0, 2.6, 11.3], [['1 croissant', 60]]),
  B('pancake', 'Pancake', [227, 6.4, 28.3, 9.7, 0.9, 5.0], [['1 pancake', 40]]),

  // Meat, fish, eggs & plant protein
  B('chicken_breast', 'Chicken breast (cooked)', [165, 31.0, 0, 3.6, 0, 0], [['1 breast', 140], ['portion', 100]], { also: 'grilled roast' }),
  B('chicken_thigh', 'Chicken thigh (cooked, skinless)', [190, 25.0, 0, 9.8, 0, 0], [['1 thigh', 70]]),
  B('turkey_breast', 'Turkey breast (cooked)', [147, 30.0, 0, 2.1, 0, 0], [['portion', 100]]),
  B('beef_mince_lean', 'Beef mince, 5% fat (cooked)', [164, 25.6, 0, 6.4, 0, 0], [['portion', 100]], { also: 'ground beef lean' }),
  B('beef_mince', 'Beef mince, 20% fat (cooked)', [260, 26.0, 0, 17.0, 0, 0], [['portion', 100]], { also: 'ground beef' }),
  B('steak', 'Steak (sirloin, cooked)', [195, 29.0, 0, 8.0, 0, 0], [['1 steak', 170], ['portion', 100]], { also: 'beef' }),
  B('pork_chop', 'Pork chop (cooked)', [200, 28.0, 0, 9.5, 0, 0], [['1 chop', 120]]),
  B('bacon', 'Bacon (streaky, cooked)', [541, 37.0, 1.4, 41.8, 0, 0], [['1 rasher', 10]]),
  B('ham', 'Ham (sliced)', [115, 18.0, 1.5, 4.0, 0, 1.0], [['1 slice', 15], ['3 slices', 45]]),
  B('sausage', 'Pork sausage (cooked)', [290, 15.0, 8.0, 22.0, 0.5, 1.0], [['1 sausage', 40]]),
  B('salmon', 'Salmon (cooked)', [206, 22.1, 0, 12.4, 0, 0], [['1 fillet', 120]]),
  B('tuna', 'Tuna (tinned in water, drained)', [116, 25.5, 0, 0.8, 0, 0], [['1 tin drained', 112], ['½ tin', 56]], { also: 'canned' }),
  B('cod', 'Cod (cooked)', [105, 22.8, 0, 0.9, 0, 0], [['1 fillet', 120]], { also: 'white fish haddock' }),
  B('prawns', 'Prawns (cooked)', [99, 24.0, 0.2, 0.3, 0, 0], [['portion', 100], ['handful', 60]], { also: 'shrimp' }),
  B('egg', 'Egg', [143, 12.6, 0.7, 9.5, 0, 0.4], [['1 medium egg', 50], ['1 large egg', 58], ['2 eggs', 100]], { also: 'boiled poached' }),
  B('egg_white', 'Egg white', [52, 10.9, 0.7, 0.2, 0, 0.7], [['1 white', 33]]),
  B('scrambled', 'Scrambled eggs', [149, 10.0, 1.6, 11.0, 0, 1.4], [['2 eggs', 120]]),
  B('fried_egg', 'Fried egg', [196, 13.6, 0.8, 14.8, 0, 0.4], [['1 egg', 46]]),
  B('tofu', 'Tofu (firm)', [144, 15.8, 2.8, 8.7, 2.3, 0.6], [['portion', 100]]),
  B('tempeh', 'Tempeh', [192, 20.3, 7.6, 10.8, 0, 0], [['portion', 100]]),
  B('lentils', 'Lentils (cooked)', [116, 9.0, 20.1, 0.4, 7.9, 1.8], [['portion', 100], ['1 cup', 198]]),
  B('chickpeas', 'Chickpeas (tinned, drained)', [139, 7.0, 22.5, 2.8, 7.6, 0.2], [['½ tin', 120]], { also: 'garbanzo' }),
  B('black_beans', 'Black beans (cooked)', [132, 8.9, 23.7, 0.5, 8.7, 0.3], [['portion', 100]]),
  B('kidney_beans', 'Kidney beans (cooked)', [127, 8.7, 22.8, 0.5, 6.4, 0.3], [['portion', 100]]),
  B('baked_beans', 'Baked beans', [78, 4.7, 12.9, 0.2, 3.8, 4.7], [['½ tin', 207], ['portion', 150]]),
  B('peanut_butter', 'Peanut butter', [588, 25.1, 20.0, 50.4, 6.0, 9.2], [['1 tbsp', 16], ['1 tsp', 5]]),
  B('almonds', 'Almonds', [579, 21.2, 21.6, 49.9, 12.5, 4.4], [['handful', 30]], { also: 'nuts' }),
  B('walnuts', 'Walnuts', [654, 15.2, 13.7, 65.2, 6.7, 2.6], [['handful', 30]], { also: 'nuts' }),
  B('cashews', 'Cashews', [553, 18.2, 30.2, 43.9, 3.3, 5.9], [['handful', 30]], { also: 'nuts' }),
  B('peanuts', 'Peanuts', [567, 25.8, 16.1, 49.2, 8.5, 4.7], [['handful', 30]], { also: 'nuts' }),
  B('mixed_nuts', 'Mixed nuts', [607, 20.0, 21.0, 54.0, 7.0, 4.0], [['handful', 30]]),
  B('chia', 'Chia seeds', [486, 16.5, 42.1, 30.7, 34.4, 0], [['1 tbsp', 12]]),
  B('whey', 'Protein powder (whey)', [400, 78.0, 8.0, 6.0, 0, 5.0], [['1 scoop', 30]], { also: 'shake' }),
  B('protein_bar', 'Protein bar', [350, 33.0, 37.0, 12.0, 8.0, 6.0], [['1 bar', 60]]),

  // Dairy & alternatives
  B('milk_semi', 'Milk (semi-skimmed)', [46, 3.5, 4.8, 1.7, 0, 4.8], [['splash', 30], ['glass', 200], ['1 cup', 250]], { ml: true, also: '2%' }),
  B('milk_whole', 'Milk (whole)', [64, 3.4, 4.7, 3.6, 0, 4.7], [['splash', 30], ['glass', 200]], { ml: true }),
  B('milk_skimmed', 'Milk (skimmed)', [35, 3.5, 5.0, 0.1, 0, 5.0], [['splash', 30], ['glass', 200]], { ml: true }),
  B('oat_milk', 'Oat milk', [46, 1.0, 6.7, 1.5, 0.8, 4.0], [['splash', 30], ['glass', 200]], { ml: true, also: 'oatly' }),
  B('almond_milk', 'Almond milk (unsweetened)', [13, 0.4, 0.1, 1.1, 0.2, 0.1], [['splash', 30], ['glass', 200]], { ml: true }),
  B('soya_milk', 'Soya milk (unsweetened)', [33, 3.0, 0.2, 1.8, 0.5, 0.1], [['splash', 30], ['glass', 200]], { ml: true, also: 'soy' }),
  B('greek_0', 'Greek yoghurt (0% fat)', [57, 10.2, 3.6, 0.4, 0, 3.2], [['pot', 170], ['3 tbsp', 100]], { also: 'yogurt fat free' }),
  B('greek_full', 'Greek yoghurt (full fat)', [96, 9.0, 3.9, 5.0, 0, 3.9], [['pot', 170], ['3 tbsp', 100]], { also: 'yogurt' }),
  B('yoghurt_natural', 'Natural yoghurt', [61, 3.5, 4.7, 3.3, 0, 4.7], [['pot', 125], ['bowl', 150]], { also: 'yogurt plain' }),
  B('skyr', 'Skyr', [63, 11.0, 4.0, 0.2, 0, 4.0], [['pot', 150]], { also: 'icelandic yogurt' }),
  B('cottage', 'Cottage cheese', [98, 11.1, 3.4, 4.3, 0, 2.7], [['portion', 100]]),
  B('cheddar', 'Cheddar', [403, 24.9, 1.3, 33.1, 0, 0.5], [['1 slice', 20], ['portion', 30]], { also: 'cheese' }),
  B('mozzarella', 'Mozzarella', [250, 18.5, 1.0, 19.5, 0, 1.0], [['1 ball', 125], ['portion', 30]], { also: 'cheese' }),
  B('feta', 'Feta', [264, 14.2, 4.1, 21.3, 0, 4.1], [['portion', 30]], { also: 'cheese' }),
  B('parmesan', 'Parmesan', [392, 35.8, 3.2, 25.8, 0, 0.8], [['1 tbsp grated', 5], ['portion', 10]], { also: 'cheese' }),
  B('halloumi', 'Halloumi', [320, 21.5, 1.5, 25.5, 0, 1.5], [['1 slice', 25], ['3 slices', 75]], { also: 'cheese' }),
  B('butter', 'Butter', [717, 0.9, 0.1, 81.1, 0, 0.1], [['1 tsp', 5], ['for 1 slice', 7], ['1 tbsp', 14]]),
  B('ice_cream', 'Ice cream (vanilla)', [207, 3.5, 23.6, 11.0, 0.7, 21.2], [['1 scoop', 60]]),

  // Oils, sauces & sweet things
  B('olive_oil', 'Olive oil', [884, 0, 0, 100, 0, 0], [['1 tbsp', 14], ['1 tsp', 5]], { also: 'oil cooking' }),
  B('honey', 'Honey', [304, 0.3, 82.4, 0, 0.2, 82.1], [['1 tsp', 7], ['1 tbsp', 21]]),
  B('sugar', 'Sugar', [387, 0, 100, 0, 0, 100], [['1 tsp', 4]]),
  B('maple', 'Maple syrup', [260, 0, 67.0, 0.1, 0, 60.0], [['1 tbsp', 20]]),
  B('jam', 'Jam', [250, 0.4, 62.0, 0.1, 0.8, 60.0], [['1 tsp', 7], ['1 tbsp', 15]]),
  B('ketchup', 'Ketchup', [101, 1.0, 27.4, 0.1, 0.3, 22.8], [['1 tbsp', 17]]),
  B('mayo', 'Mayonnaise', [680, 1.0, 0.6, 75.0, 0, 0.6], [['1 tbsp', 14]]),
  B('soy_sauce', 'Soy sauce', [53, 8.1, 4.9, 0.6, 0.8, 0.4], [['1 tbsp', 16]]),
  B('dark_choc', 'Dark chocolate (70–85%)', [598, 7.8, 45.9, 42.6, 10.9, 24.0], [['1 square', 10], ['4 squares', 40]]),
  B('milk_choc', 'Milk chocolate', [535, 7.7, 59.4, 29.7, 3.4, 51.5], [['4 squares', 25]]),
  B('crisps', 'Crisps', [530, 6.5, 53.0, 33.0, 4.5, 0.5], [['1 bag', 25]], { also: 'chips' }),
  B('popcorn', 'Popcorn (air-popped)', [387, 12.9, 77.8, 4.5, 14.5, 0.9], [['1 cup', 8], ['bowl', 25]]),
  B('digestive', 'Digestive biscuit', [485, 7.1, 62.6, 21.5, 3.6, 16.6], [['1 biscuit', 15]], { also: 'cookie' }),
  B('pizza', 'Pizza (margherita)', [266, 11.4, 33.3, 9.7, 2.3, 3.6], [['1 slice', 100]]),

  // Drinks
  B('coffee', 'Coffee (black)', [1, 0.1, 0, 0, 0, 0], [['1 cup', 240]], { ml: true, also: 'americano espresso' }),
  B('latte', 'Latte (semi-skimmed)', [42, 2.8, 4.2, 1.6, 0, 4.2], [['small', 240], ['medium', 350], ['large', 470]], { ml: true }),
  B('cappuccino', 'Cappuccino (semi-skimmed)', [30, 2.0, 3.0, 1.1, 0, 3.0], [['small', 240], ['medium', 350]], { ml: true }),
  B('flat_white', 'Flat white (semi-skimmed)', [43, 2.9, 4.3, 1.6, 0, 4.3], [['1 cup', 240]], { ml: true }),
  B('tea', 'Tea with milk', [6, 0.4, 0.6, 0.2, 0, 0.6], [['1 mug', 250]], { ml: true }),
  B('orange_juice', 'Orange juice', [45, 0.7, 10.4, 0.2, 0.2, 8.4], [['glass', 200], ['small glass', 150]], { ml: true, also: 'oj' }),
  B('smoothie', 'Fruit smoothie', [55, 0.6, 12.5, 0.2, 1.2, 11.0], [['bottle', 250]], { ml: true }),
  B('cola', 'Cola', [42, 0, 10.6, 0, 0, 10.6], [['1 can', 330]], { ml: true, also: 'coke' }),
  B('diet_cola', 'Diet cola', [0, 0, 0, 0, 0, 0], [['1 can', 330]], { ml: true, also: 'coke zero pepsi max' }),
  B('beer', 'Beer (lager)', [43, 0.5, 3.6, 0, 0, 0], [['pint', 568], ['bottle', 330]], { ml: true }),
  B('red_wine', 'Red wine', [85, 0.1, 2.6, 0, 0, 0.6], [['glass', 175], ['small glass', 125]], { ml: true }),
  B('white_wine', 'White wine', [82, 0.1, 2.6, 0, 0, 1.0], [['glass', 175], ['small glass', 125]], { ml: true }),
  B('prosecco', 'Prosecco', [75, 0.1, 1.5, 0, 0, 1.5], [['glass', 125]], { ml: true, also: 'champagne sparkling' }),
];

const BY_KEY = new Map(BASICS.map((f) => [f.key, f]));
export const basicByKey = (key: string) => BY_KEY.get(key) ?? null;

/** Instant local matches: every word must appear in the name or its other names. Best match first. */
export function searchBasics(q: string, limit = 8): Food[] {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { f: Food; s: number }[] = [];
  for (const f of BASICS) {
    const name = f.name.toLowerCase();
    const hay = `${name} ${f.also ?? ''}`;
    if (!words.every((w) => hay.includes(w) || hay.includes(singular(w)))) continue;
    let s = 0;
    if (name.startsWith(words[0])) s += 3;
    if (name.split(/[^a-z]+/).some((t) => t === words[0] || t === singular(words[0]))) s += 2;
    s -= name.length / 100;
    scored.push({ f, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.f);
}

const singular = (w: string) => (w.length > 3 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);

const EMOJI: Record<string, string> = {
  apple: '🍎', banana: '🍌', orange: '🍊', clementine: '🍊', grapes: '🍇', strawberries: '🍓', blueberries: '🫐', raspberries: '🍓',
  blackberries: '🫐', pear: '🍐', peach: '🍑', nectarine: '🍑', plum: '🍑', mango: '🥭', pineapple: '🍍', watermelon: '🍉', melon: '🍈',
  kiwi: '🥝', avocado: '🥑', cherries: '🍒', pomegranate: '🍎', grapefruit: '🍊', dates: '🌴', raisins: '🍇', apricot: '🍑',
  broccoli: '🥦', spinach: '🥬', carrot: '🥕', tomato: '🍅', cucumber: '🥒', salad: '🥗', pepper: '🫑', onion: '🧅', mushrooms: '🍄',
  courgette: '🥒', sweet_potato: '🍠', potato_baked: '🥔', potato_boiled: '🥔', mash: '🥔', fries: '🍟', peas: '🫛', green_beans: '🫛',
  sweetcorn: '🌽', cauliflower: '🥦', asparagus: '🌿', kale: '🥬', cabbage: '🥬', sprouts: '🥬', celery: '🥬', beetroot: '🍠',
  edamame: '🫛', aubergine: '🍆', squash: '🎃', rice_white: '🍚', rice_brown: '🍚', pasta: '🍝', pasta_dry: '🍝', pasta_wholewheat: '🍝',
  oats: '🥣', porridge_water: '🥣', porridge_milk: '🥣', bread_white: '🍞', bread_wholemeal: '🍞', sourdough: '🍞', bagel: '🥯',
  wrap: '🌯', pitta: '🫓', naan: '🫓', quinoa: '🍚', couscous: '🍚', noodles_egg: '🍜', noodles_rice: '🍜', granola: '🥣',
  cornflakes: '🥣', muesli: '🥣', rice_cake: '🍘', croissant: '🥐', pancake: '🥞', chicken_breast: '🍗', chicken_thigh: '🍗',
  turkey_breast: '🍗', beef_mince_lean: '🥩', beef_mince: '🥩', steak: '🥩', pork_chop: '🥩', bacon: '🥓', ham: '🥓', sausage: '🌭',
  salmon: '🐟', tuna: '🐟', cod: '🐟', prawns: '🦐', egg: '🥚', egg_white: '🥚', scrambled: '🍳', fried_egg: '🍳', tofu: '🧈',
  tempeh: '🧈', lentils: '🫘', chickpeas: '🫘', black_beans: '🫘', kidney_beans: '🫘', baked_beans: '🫘', peanut_butter: '🥜',
  almonds: '🥜', walnuts: '🥜', cashews: '🥜', peanuts: '🥜', mixed_nuts: '🥜', chia: '🌱', whey: '🥤', protein_bar: '🍫',
  milk_semi: '🥛', milk_whole: '🥛', milk_skimmed: '🥛', oat_milk: '🥛', almond_milk: '🥛', soya_milk: '🥛', greek_0: '🥣',
  greek_full: '🥣', yoghurt_natural: '🥣', skyr: '🥣', cottage: '🧀', cheddar: '🧀', mozzarella: '🧀', feta: '🧀', parmesan: '🧀',
  halloumi: '🧀', butter: '🧈', ice_cream: '🍨', olive_oil: '🫒', honey: '🍯', sugar: '🧂', maple: '🍯', jam: '🍓', ketchup: '🍅',
  mayo: '🥚', soy_sauce: '🥢', dark_choc: '🍫', milk_choc: '🍫', crisps: '🥔', popcorn: '🍿', digestive: '🍪', pizza: '🍕',
  coffee: '☕', latte: '☕', cappuccino: '☕', flat_white: '☕', tea: '🍵', orange_juice: '🧃', smoothie: '🥤', cola: '🥤',
  diet_cola: '🥤', beer: '🍺', red_wine: '🍷', white_wine: '🥂', prosecco: '🥂',
};

/** A friendly picture for foods without a product photo. */
export function foodEmoji(key: string | null | undefined): string {
  if (!key) return '🍽️';
  if (key.startsWith('basic:')) return EMOJI[key.slice(6)] ?? '🍽️';
  if (key.startsWith('quick:')) return '⚡️';
  if (key.startsWith('est:')) return '✨';
  return '🍽️';
}
