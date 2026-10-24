# 75 Hard

**Live:** https://swag-75.pages.dev (Cloudflare Pages; the old https://hard-75.netlify.app stays on the version from 13 October)

A simple, good-looking daily tracker for the 75 Hard challenge. It's styled after Lifesum's forest green, and it's built as a React app that ships as a website now and as an iPhone app later.

**What it tracks each day**

| Task | How it's logged |
| --- | --- |
| Workouts: 90 minutes a day in any mix (say 45 min reformer + 30 min weights + 15 min stairs) | Pick from 100+ activities, set the length and Light / Normal / Hard; favourites log in one tap; Apple Health workouts come in too |
| Water (any goal; presets for 2–4.5 L) | Tap glasses (250 ml each); also picks up water logged in Lifesum |
| Read 10 pages | Switch |
| No alcohol | Toggle |
| Steps: weekly goal (70,000 by default), not a daily pass/fail | Apple Health, the iPhone Shortcut, or typed in |
| Food and calories, not a tick-box | The Food tab: search, barcode scan, a photo or a description of the meal, quick add; macros too. Shown against the calorie target, never pass/fail |

Not pass/fail, but tracked every day if she wants: **weight** (kg, lb or stone; the Progress tab shows each weigh-in and the 7-day average) and a **progress photo** (private, with a before/after compare). There's also a notes box for each day. The top of Today shows **Eaten · Burned · Steps** as rings (calories left under Eaten), with **net calories** underneath once she's logged some food.

**A relaxed 75: nothing restarts and nothing moves.** It's always 75 calendar days from the start date. Each day is simply logged as it went: a **full day** when all four tasks are ticked off, otherwise **partly done** (the Progress calendar shows how many, e.g. 3/4). The **weekly recap** is where it adds up: the share of tasks done, full days, and each habit across the week. Days can be filled in or changed later from the Progress calendar (with a one-tap "Tick everything off" for past days). A manual **Restart at day 1** is still in Profile. Already partway through when signing up? Choose **Earlier**, pick the real start date, and optionally tick off every day so far. The start date can be changed later in Profile.

## Workouts and calories burned

No heart-rate strap needed. Each of the ~105 activities in `src/lib/activities.ts` has three energy costs (light / normal / hard, in METs) from the Compendium of Physical Activities, the research table most fitness apps use, and each says what that effort means for that activity ("advanced, jumpboard, little rest" for reformer, "12 min/mile" for running). Calories are **active** calories, the extra burned by working out:

```
(MET − 1) × resting burn per minute × minutes
```

A MET is a multiple of her own resting rate, so the workout and the resting burn it replaces are measured the same way. Resting burn comes from Mifflin-St Jeor (weight from her latest weigh-in, height and sex from Profile → About you, age from her birthday), or the textbook 1 MET (3.5 ml/kg/min) until those are filled in. (Earlier versions measured the workout with the textbook MET but took off her Mifflin rate, which overstated a 90-minute day by about a fifth.) Estimates are worked out when shown, so they sharpen as she adds details.

**Calories left, active and net.** **Calories left** (under the Eaten ring on Today, and in the Food tab's ring) is her calorie target minus what she's eaten. Workouts never add calories back, because her target already includes her deficit. The Burned ring fills with **active** calories only (workouts plus everyday walking from her step count), towards an active goal (Profile → Food & calories; by default her workout goal at normal effort plus her step goal), so it starts at zero each morning and fills up through the day. Steps taken during a logged walk or run are already in that workout, so they're taken off before steps are counted (`src/lib/energy.ts`). **Net calories** = eaten − everything burned (resting so far + active), and only show once she's logged some food, with how many meals that covers ("2 of 4 meals logged"), since a meal not logged yet isn't a deficit. For today, resting only counts the hours that have passed. Tap Burned or Net on Today for the full breakdown; Progress shows net calories for each day of the week.

The day's workouts count once their minutes add up to the daily total (Profile → Daily goals → Workouts, 90 by default). Older days logged as "workout 1 / workout 2" are read the same way.

## Food diary

The Food tab (and the meal rows on Today) log food in a few taps. Logging speed comes first:

- **The "+" on any food logs it straight away** with the amount she used last time (or its usual serving), and the sheet stays open for the next thing. Undo is in the footer.
- **Search** covers her own foods first, then ~150 everyday foods (`src/lib/basics.ts`: fruit, eggs, oats, chicken, rice, coffee… with real portions like "1 medium (118 g)"), then packaged products from [Open Food Facts](https://world.openfoodfacts.org), the free, open food database (UK products first).
- **Barcode scan** reads the barcode in the camera live (the phone's own detector where there is one, otherwise a bundled reader). It also works from a photo of the barcode or by typing the number. A product that isn't in Open Food Facts can be copied from the label once, and the next scan finds it.
- **Photo** and **Describe it** estimate a whole meal ("2 scrambled eggs on sourdough with butter") as separate items she can tick, untick and resize before adding (see the setup below).
- **Quick add**: just calories, optionally a name and macros.
- **Your usual**: an empty meal offers what she has most often had for it on similar days (weekdays with weekdays, weekends with weekends) over the last two weeks, logged in one tap ("You've had this on 4 of the last 5 weekdays"). Worked out from her diary (`src/lib/usual.ts`), so there's nothing to set up. Today shows it for the meal coming up; the add sheet shows it at the top.
- **One tap on an empty meal**: alongside her usual, chips for **the same as yesterday**, a **meal-prep portion**, **saved meals** she's chosen for that meal, and (for snacks) her **go-to snacks**. Every one-tap log has Undo.
- **Saved meals**: "Save as a meal" on any meal with two or more foods; untick anything that wasn't part of it and choose which meals to offer it at. All saved meals are also listed in the add sheet.
- **Favourites** and **Recent** (sorted for the meal she's logging).
- **Macros**: protein, carbs and fat for every food, and targets from Profile → Food & calories or the Food tab (a balanced, high-protein or lower-carb split of her calorie target, or her own grams).

### Meal prep

For batch cooking. On the Food tab, **Meal prep → +** opens the batch: she adds everything that went in (search, barcode, photo or quick add, the same as logging food, but nothing goes in the diary), splits it into equal portions, and can log one straight away. Each portion she eats is one diary entry; the add sheet lists her batches with **½ · 1 · 1½** and how many portions are left, and empty lunches and dinners offer a portion in one tap. A portion's food key is `prep:<batch id>`, so the batch counts down however the portion got into the diary or left it: logged, copied from yesterday, changed from ½ to 1, deleted, or undone (`src/lib/mealPrep.ts`, `src/data/FoodData.tsx`). Needs migration `0016_meal_prep.sql`.

The day's total is written to `daily_logs.calories` as the diary changes, so Today, the weekly recap and Progress all agree. Moving over from Lifesum: the first time something is logged in the diary on a day that already has Lifesum calories, those calories become one "Logged in Lifesum" entry so the day's total doesn't drop, and from then on the diary wins over Apple Health for that day.

Open Food Facts is called straight from the phone (their limits are per person; search waits until she pauses typing), and falls back to the `food` server function if a request is blocked.

## Weight and progress photos

Weigh-ins are stored in kg and shown in her unit. Photos are shrunk on the phone (1600 px plus a small gallery copy) and re-encoded, which strips the hidden location data an iPhone camera adds, then go to a **private** storage bucket where each account can only reach its own folder. The app shows them through links that expire after an hour. Download my data lists them, and deleting the account deletes them.

## Weekly recap

The first time the app is opened in a new week, a "Your week" card sums up the last Monday–Sunday: the share of tasks done, full days (a dot per day; partly done days show e.g. 3/4), steps against the weekly goal, average water, workouts, reading, alcohol-free days and average calories eaten. Every week can be revisited from Progress → Weekly recap.

## Birthday pass

Everyone adds their birthday at sign-up (or in Profile). From a week before it until a month after, a **birthday pass** appears on Today: use it on any day and that day counts as a full day. One per birthday, and it can be undone.

## Lifesum and Apple Health

Lifesum has no public API, but it writes the food you log to **Apple Health** as *Dietary Energy*. The app reads calories from Apple Health, so the Lifesum integration comes for free once Health is connected. Steps, water and workouts come from the same place.

There are two ways in:

1. **iPhone app (native, best).** The Capacitor build reads HealthKit directly using [`@capgo/capacitor-health`](https://github.com/Cap-go/capacitor-health). It syncs when the app opens or comes back to the foreground, and when you tap the refresh button.
2. **Web app (works today).** A browser can't read HealthKit, so an iPhone **Shortcut** reads the last 7 days of steps and posts them in one request (a list of values and a list of dates) to Supabase (`sync_steps` RPC, which hands each day to `ingest_health`) with a private token. **Profile → Apple Health → Set up** walks through it and gives copy buttons for the URL, key and token. Run it with a few *Time of day* automations, or tap **Sync steps** (the ↻ button on Today, or in the Steps sheet), which opens the Shortcut by name (`Hard75` by default; changeable per phone in the set-up sheet) and reloads the steps when she's back. (Calories now come from the in-app food diary.)

Both are optional. Everything can be typed in by hand.

## Setup

### 1. Supabase

1. In the [SQL editor](https://supabase.com/dashboard/project/vublvpjshnkybdilzcog/sql/new), paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then [`0002_pet.sql`](supabase/migrations/0002_pet.sql), [`0003_pet_style.sql`](supabase/migrations/0003_pet_style.sql) and [`0004_birthday.sql`](supabase/migrations/0004_birthday.sql). If the app ever says the database is missing a column, run [`0005_catch_up.sql`](supabase/migrations/0005_catch_up.sql): it adds anything from 0002–0004 that's missing, refreshes the API's schema cache, and is safe to run any number of times. [`0006_health_lookback.sql`](supabase/migrations/0006_health_lookback.sql) lets the Shortcut send the last few days (each with a `p_date`): steps keep the higher number, today's calories replace what's saved, and earlier days' calories keep the higher number. [`0007_health_replace.sql`](supabase/migrations/0007_health_replace.sql) supersedes that: for today and the 6 days before it, each Shortcut run replaces the steps and calories it sends (so a bad run is fixed by running it again); the partly-covered oldest day of a 7-day window only goes up; zeros are ignored; numbers typed by hand are kept (steps unless Health is higher). [`0008_hardening.sql`](supabase/migrations/0008_hardening.sql) applies two fixes from Supabase's security advisor. [`0009_security.sql`](supabase/migrations/0009_security.sql) tightens table privileges and adds the data-rights functions (new sync token, delete my account). [`0010_health_week.sql`](supabase/migrations/0010_health_week.sql) removes a one-off Shortcut test endpoint. [`0011_workouts_weight_photos.sql`](supabase/migrations/0011_workouts_weight_photos.sql) adds the daily workout total, favourites, body details, weigh-ins and the private `progress-photos` bucket with its policies. [`0012_food.sql`](supabase/migrations/0012_food.sql) adds the food diary (see step 4). [`0013_health_resync.sql`](supabase/migrations/0013_health_resync.sql) makes every day the Shortcut sends replace what's saved (so re-running a fixed Shortcut corrects old days too; numbers typed by hand and the food diary are still kept) and records when the Shortcut last synced, shown in Profile. [`0015_sync_steps.sql`](supabase/migrations/0015_sync_steps.sql) adds `sync_steps`, so the Shortcut can send the whole week in one request without a Repeat loop; it reads dates in any format Shortcuts produces. [`0016_meal_prep.sql`](supabase/migrations/0016_meal_prep.sql) adds meal prep (`meal_preps`) and the meals a saved meal is offered at (`saved_meals.slots`); until it's run the app still works, meal prep just asks for it. The migrations create `profiles`, `challenges` and `daily_logs` with row-level security, so each person only sees their own rows. It also creates the `ingest_health` function the Shortcut uses.
2. Under **Authentication → URL Configuration**, set the **Site URL** to `https://swag-75.pages.dev` and add `https://swag-75.pages.dev/**` under **Redirect URLs**, so confirmation and password-reset emails link back to the app (Supabase ignores the app's own link unless it's on that list). Opening a reset link signs her in and asks for a new password; Profile also has **Change password**.
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
  App.tsx                 tab shell (Today · Food · Progress · Profile)
  screens/                Auth, Onboarding, Today, Food, Progress, Profile
  components/             rings, toggles, steppers, bottom sheets, icons
  components/food/        the logging sheet, barcode scanner, targets, meal icons,
                          one-tap suggestions, meal prep
  data/AppData.tsx        app state, optimistic saves (only changed fields are written)
  data/FoodData.tsx       the food diary, her foods and saved meals
  data/repo.ts            Supabase backend + on-device fallback
  lib/nutrition.ts        portions, macros, totals, targets
  lib/basics.ts           everyday foods without a barcode
  lib/off.ts              Open Food Facts lookups
  lib/barcode.ts          barcode reading (native detector or zxing)
  lib/energy.ts           resting + workouts + steps = burned; net calories
  lib/usual.ts            "your usual", same as yesterday, go-to snacks (from her diary)
  lib/mealPrep.ts         meal-prep batches: portions, ½ / 1 / 1½, what's left
  lib/weeks.ts            challenge weeks 1–11 for the Progress week-by-week view
  lib/challenge.ts        75 Hard rules: day numbers, task checks, full and partly done days
  lib/activities.ts       workout library + calorie estimates
  lib/body.ts             weight units, 7-day average, body details for estimates
  lib/photos.ts           shrink + clean photos before upload
  health/                 HealthKit reader + merge rules (steps/water never go down,
                          Lifesum calories win unless typed by hand)
supabase/migrations/      schema, RLS, Shortcut endpoint
supabase/functions/food/  meal estimates (Workers AI) + Open Food Facts fallback
ios/                      Capacitor iOS project
```
