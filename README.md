# 75 Hard

**Live:** https://swag-75.pages.dev (Cloudflare Pages; the old https://hard-75.netlify.app stays on the version from 13 October)

A simple, good-looking daily tracker for the 75 Hard challenge. It's styled after Lifesum's forest green, and it's built as a React app that ships as a website now and as an iPhone app later.

**What it tracks each day**

| Task | How it's logged |
| --- | --- |
| Workouts: 90 minutes a day in any mix (say 45 min reformer + 30 min weights + 15 min stairs) | Pick from 100+ activities, set the length and Light / Normal / Hard; favourites log in one tap; Apple Health workouts come in too |
| Water (any goal; presets for 2–4.5 L) | Tap glasses (250 ml each); also picks up water logged in Lifesum |
| Read 10 pages | Switch |
| Follow a diet, no cheat meals | Toggles |
| No alcohol | Toggle |
| Steps: weekly goal (70,000 by default), not a daily pass/fail | Apple Health, the iPhone Shortcut, or typed in |
| Food and calories | The Food tab: search, barcode scan, a photo or a description of the meal, quick add; macros too. Lifesum through Apple Health still works (shown against the calorie target, not pass/fail) |

Not pass/fail, but tracked every day if she wants: **weight** (kg, lb or stone; the Progress tab shows each weigh-in and the 7-day average) and a **progress photo** (private, with a before/after compare). There's also a notes box for each day. The top of Today shows **Eaten · Burned · Steps** as rings, with **net calories** (eaten minus burned) underneath.

**Missed days extend the challenge rather than restarting it.** A day only counts when every task is ticked off. A missed day just doesn't count: it shows as **+1** on the Progress grid, and the finish line moves back a day. The challenge ends on the 75th completed day. If a day was done but not logged, fill it in and it counts again. A manual **Restart at day 1** is still in Profile. Already partway through when signing up? Choose **Earlier**, pick the real start date, and optionally tick off every day so far. Any past day can be opened from the Progress calendar and filled in or changed (there's a one-tap "Tick everything off" for past days). The start date can be changed later in Profile.

## Workouts and calories burned

No heart-rate strap needed. Each of the ~105 activities in `src/lib/activities.ts` has three energy costs (light / normal / hard, in METs) from the Compendium of Physical Activities, the research table most fitness apps use, and each says what that effort means for that activity ("advanced, jumpboard, little rest" for reformer, "12 min/mile" for running). Calories are **active** calories, the extra burned by working out:

```
(MET × 3.5 × weight kg ÷ 200 − resting burn per minute) × minutes
```

Resting burn comes from Mifflin-St Jeor (weight from her latest weigh-in, height and sex from Profile → About you, age from her birthday), or 1 MET until those are filled in. Estimates are worked out when shown, so they sharpen as she adds details.

**Total and active.** The Burned ring on Today fills with **active** calories (workouts plus everyday walking from her step count) towards an active goal (Profile → Food & calories; by default her workout goal at normal effort plus her step goal). Under it is the **total**: resting burn plus active. For today, resting only counts the hours that have passed, so the numbers are true right now. Steps taken during a logged walk or run are already in that workout, so they're taken off before steps are counted (`src/lib/energy.ts`). **Net calories** = eaten − total. Tap Burned or Net on Today for the full breakdown; Progress shows net calories for each day of the week.

The day's workouts count once their minutes add up to the daily total (Profile → Daily goals → Workouts, 90 by default). Older days logged as "workout 1 / workout 2" are read the same way.

## Food diary

The Food tab (and the meal rows on Today) log food in a few taps. Logging speed comes first:

- **The "+" on any food logs it straight away** with the amount she used last time (or its usual serving), and the sheet stays open for the next thing. Undo is in the footer.
- **Search** covers her own foods first, then ~150 everyday foods (`src/lib/basics.ts`: fruit, eggs, oats, chicken, rice, coffee… with real portions like "1 medium (118 g)"), then packaged products from [Open Food Facts](https://world.openfoodfacts.org), the free, open food database (UK products first).
- **Barcode scan** reads the barcode in the camera live (the phone's own detector where there is one, otherwise a bundled reader). It also works from a photo of the barcode or by typing the number. A product that isn't in Open Food Facts can be copied from the label once, and the next scan finds it.
- **Photo** and **Describe it** estimate a whole meal ("2 scrambled eggs on sourdough with butter") as separate items she can tick, untick and resize before adding (see the setup below).
- **Quick add**: just calories, optionally a name and macros.
- **Favourites, Recent** (sorted for the meal she's logging), **saved meals** ("Usual breakfast" in one tap), **copy yesterday's** lunch.
- **Macros**: protein, carbs and fat for every food, and targets from Profile → Food & calories or the Food tab (a balanced, high-protein or lower-carb split of her calorie target, or her own grams).

The day's total is written to `daily_logs.calories` as the diary changes, so Today, the weekly recap and Progress all agree. Moving over from Lifesum: the first time something is logged in the diary on a day that already has Lifesum calories, those calories become one "Logged in Lifesum" entry so the day's total doesn't drop, and from then on the diary wins over Apple Health for that day.

Open Food Facts is called straight from the phone (their limits are per person; search waits until she pauses typing), and falls back to the `food` server function if a request is blocked.

## Weight and progress photos

Weigh-ins are stored in kg and shown in her unit. Photos are shrunk on the phone (1600 px plus a small gallery copy) and re-encoded, which strips the hidden location data an iPhone camera adds, then go to a **private** storage bucket where each account can only reach its own folder. The app shows them through links that expire after an hour. Download my data lists them, and deleting the account deletes them.

## Weekly recap

The first time the app is opened in a new week, a "Your week" card sums up the last Monday–Sunday: days completed (with a dot per day), steps against the weekly goal, average water, workouts, reading, any perfect-week treat and any evolution. Every week can be revisited from Progress → Weekly recap.

## Birthday pass

Everyone adds their birthday at sign-up (or in Profile). From a week before it until a month after, a **birthday pass** appears on Today: use it on any day and that day counts as complete (the pet gets cake). One per birthday, and it can be undone.

## Mochi the sloth

A pet keeps her company through the 75 days (Pet tab, plus a card on Today):

- **Evolves** with completed days: Baby (days 1–9) → Sprout (10–14) → Mover (15–24) → Athlete (25–34) → Champion (35–49) → Legend (50–75), getting fitter at every stage.
- **Girl, guy or non-binary** sloth, and any name (Pet → Edit). It's alive: it breathes, sways, glances around, reacts to its mood, and does a happy squish with hearts when tapped.
- **Gets hungry** when days are missed in a row: hungry, then very hungry, then starving from the third missed day. It never dies. Finishing a day fills it back up.
- **Treats:** every perfect Monday–Sunday week earns one. A treat feeds the pet for a missed day; it doesn't change the 75.
- **Unicorn:** a rainbow unicorn flies across the screen whenever a day is completed.

The Pet tab is a Pokémon GO-style scene (`src/components/PetWorld.tsx`). Every evolution stage has its own world (`Biomes.tsx`: meadow, forest glade, mountain trail, lakeside cliffs, sunset peaks, the summit) with its own platform, sloth size and, at the top, a power aura; unlocked worlds can be picked from the scenery button, and the camera button opens a full-screen photo mode. Lighting that follows the time of day, weather that follows the sloth's mood, parallax depth layers you can drag to turn the sloth, a treat you throw in to feed it, and an evolution cinematic (`EvolutionSequence.tsx`). It's built so a real 3D model (GLB) can replace the sprite later. Sharp 4× versions of every sprite live in `public/pet/hd/` (upscaled with Real-ESRGAN animevideov3); the originals are used for small thumbnails. The pet's name, style and treats are saved on the challenge (`supabase/migrations/0002_pet.sql` and `0003_pet_style.sql`). The artwork lives in `public/pet/{girl,guy,nb}/` as one transparent WebP per stage and mood (`{stage}-{mood}.webp`, plus `eating.webp`).

## Lifesum and Apple Health

Lifesum has no public API, but it writes the food you log to **Apple Health** as *Dietary Energy*. The app reads calories from Apple Health, so the Lifesum integration comes for free once Health is connected. Steps, water and workouts come from the same place.

There are two ways in:

1. **iPhone app (native, best).** The Capacitor build reads HealthKit directly using [`@capgo/capacitor-health`](https://github.com/Cap-go/capacitor-health). It syncs when the app opens or comes back to the foreground, and when you tap the refresh button.
2. **Web app (works today).** A browser can't read HealthKit, so an iPhone **Shortcut** reads today's steps and dietary energy and posts them to Supabase (`ingest_health` RPC) with a private token. **Profile → Apple Health → Set up** walks through it and gives copy buttons for the URL, key and token. Run it with a *When Lifesum is closed* automation plus a few *Time of day* ones.

Both are optional. Everything can be typed in by hand.

## Setup

### 1. Supabase

1. In the [SQL editor](https://supabase.com/dashboard/project/vublvpjshnkybdilzcog/sql/new), paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then [`0002_pet.sql`](supabase/migrations/0002_pet.sql), [`0003_pet_style.sql`](supabase/migrations/0003_pet_style.sql) and [`0004_birthday.sql`](supabase/migrations/0004_birthday.sql). If the app ever says the database is missing a column, run [`0005_catch_up.sql`](supabase/migrations/0005_catch_up.sql): it adds anything from 0002–0004 that's missing, refreshes the API's schema cache, and is safe to run any number of times. [`0006_health_lookback.sql`](supabase/migrations/0006_health_lookback.sql) lets the Shortcut send the last few days (each with a `p_date`): steps keep the higher number, today's calories replace what's saved, and earlier days' calories keep the higher number. [`0007_health_replace.sql`](supabase/migrations/0007_health_replace.sql) supersedes that: for today and the 6 days before it, each Shortcut run replaces the steps and calories it sends (so a bad run is fixed by running it again); the partly-covered oldest day of a 7-day window only goes up; zeros are ignored; numbers typed by hand are kept (steps unless Health is higher). [`0008_hardening.sql`](supabase/migrations/0008_hardening.sql) applies two fixes from Supabase's security advisor. [`0009_security.sql`](supabase/migrations/0009_security.sql) tightens table privileges and adds the data-rights functions (new sync token, delete my account). [`0010_health_week.sql`](supabase/migrations/0010_health_week.sql) removes a one-off Shortcut test endpoint. [`0011_workouts_weight_photos.sql`](supabase/migrations/0011_workouts_weight_photos.sql) adds the daily workout total, favourites, body details, weigh-ins and the private `progress-photos` bucket with its policies. [`0012_food.sql`](supabase/migrations/0012_food.sql) adds the food diary (see step 4). [`0013_health_resync.sql`](supabase/migrations/0013_health_resync.sql) makes every day the Shortcut sends replace what's saved (so re-running a fixed Shortcut corrects old days too; numbers typed by hand and the food diary are still kept) and records when the Shortcut last synced, shown in Profile. The migrations create `profiles`, `challenges` and `daily_logs` with row-level security, so each person only sees their own rows. It also creates the `ingest_health` function the Shortcut uses.
2. Under **Authentication → URL Configuration**, set the Site URL to wherever the app is hosted, so confirmation emails link back to it.
3. `.env` already holds the project URL and publishable key. Both are public by design, and row-level security protects the data. Put anything secret in `.env.local`, which git ignores.
4. **Food diary.** Run [`0012_food.sql`](supabase/migrations/0012_food.sql) (diary, her foods, saved meals, macro targets, the estimate counter) and deploy the server function in [`supabase/functions/food`](supabase/functions/food) as `food` (Edge Functions → Deploy, or `supabase functions deploy food`). Search, barcodes and quick add work with just that.
5. **Photo and Describe it (free).** They use [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/), whose free daily allowance (10,000 "neurons") is far more than one person's meals need, and which doesn't keep or train on what's sent. Make a free Cloudflare account, copy the **Account ID** (Workers & Pages → Overview, right side), and create an API token (My Profile → API Tokens → Create Token → the **Workers AI** template). In Supabase, add them as Edge Function secrets named `CF_ACCOUNT_ID` and `CF_API_TOKEN`. Until they're set, the Photo and Describe buttons stay hidden. Each person gets up to 60 estimates a day, and photos are passed straight through, never stored.

Without keys the app still runs, but data is saved only on that device.

### 2. Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules, food maths, Open Food Facts parsing, calorie and merge tests
npm run build      # static site in dist/
```

### 3. Put it on her phone (today)

It's hosted on **Cloudflare Pages**, which is free with no charge per deploy (Netlify's free plan now allows about 20 deploys a month). Set up once: Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo → project name `swag-75` → Framework preset **React (Vite)**, build command `npm run build`, build output directory `dist` → **Save and Deploy**. Every push to `main` then publishes automatically. The committed `.env` supplies the Supabase settings, `.node-version` picks Node 22, and `public/_headers` sets the security headers. Then open the site in Safari and use **Share → Add to Home Screen**. It runs full-screen with its own icon.

### 4. Make it a real iPhone app (later)

The iOS project is already generated in `ios/`, with the HealthKit entitlement, permission text and app icon in place. You'll need a Mac with Xcode and an Apple Developer account (needed for HealthKit and TestFlight).

```bash
npm run ios:sync   # build the web app and copy it into ios/
npm run ios:open   # opens Xcode
```

In Xcode: pick your team under *Signing & Capabilities*, check **HealthKit** is listed there, and run on her phone. Use TestFlight to keep it installed without a cable, or submit it to the App Store.

## Project layout

```
src/
  App.tsx                 tab shell (Today · Food · Progress · Pet · Profile)
  screens/                Auth, Onboarding, Today, Food, Progress, Pet, Profile
  components/             rings, toggles, steppers, bottom sheets, icons
  components/food/        the logging sheet, barcode scanner, targets
  data/AppData.tsx        app state, optimistic saves (only changed fields are written)
  data/FoodData.tsx       the food diary, her foods and saved meals
  data/repo.ts            Supabase backend + on-device fallback
  lib/nutrition.ts        portions, macros, totals, targets
  lib/basics.ts           everyday foods without a barcode
  lib/off.ts              Open Food Facts lookups
  lib/barcode.ts          barcode reading (native detector or zxing)
  lib/energy.ts           resting + workouts + steps = burned; net calories
  lib/challenge.ts        75 Hard rules: day numbers, task checks, streaks, missed days
  lib/activities.ts       workout library + calorie estimates
  lib/body.ts             weight units, 7-day average, body details for estimates
  lib/photos.ts           shrink + clean photos before upload
  health/                 HealthKit reader + merge rules (steps/water never go down,
                          Lifesum calories win unless typed by hand)
supabase/migrations/      schema, RLS, Shortcut endpoint
supabase/functions/food/  meal estimates (Workers AI) + Open Food Facts fallback
ios/                      Capacitor iOS project
```
