# 75 Hard

**Live:** https://hard-75.netlify.app

A simple, good-looking daily tracker for the 75 Hard challenge. It's styled after Lifesum's forest green, and it's built as a React app that ships as a website now and as an iPhone app later.

**What it tracks each day**

| Task | How it's logged |
| --- | --- |
| Workout 1 and 2 (45 min each, indoors or out) | Tap to log type and length, or auto-filled from Apple Health workouts |
| Water (any goal; presets for 2–4.5 L) | Tap glasses (250 ml each); also picks up water logged in Lifesum |
| Read 10 pages | Switch |
| Follow a diet, no cheat meals | Toggles |
| No alcohol | Toggle |
| Steps: weekly goal (70,000 by default), not a daily pass/fail | Apple Health, the iPhone Shortcut, or typed in |
| Calories | Lifesum, through Apple Health, or typed in (shown against the calorie target, not pass/fail) |

The progress picture is left out on purpose. There's also a notes box for each day.

**Missed days extend the challenge rather than restarting it.** A day only counts when every task is ticked off. A missed day just doesn't count: it shows as **+1** on the Progress grid, and the finish line moves back a day. The challenge ends on the 75th completed day. If a day was done but not logged, fill it in and it counts again. A manual **Restart at day 1** is still in Profile. Already partway through when signing up? Choose **Earlier**, pick the real start date, and optionally tick off every day so far. Any past day can be opened from the Progress calendar and filled in or changed (there's a one-tap "Tick everything off" for past days). The start date can be changed later in Profile.

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

The pet's name, style and treats are saved on the challenge (`supabase/migrations/0002_pet.sql` and `0003_pet_style.sql`). The artwork lives in `public/pet/{girl,guy,nb}/` as one transparent WebP per stage and mood (`{stage}-{mood}.webp`, plus `eating.webp`).

## Lifesum and Apple Health

Lifesum has no public API, but it writes the food you log to **Apple Health** as *Dietary Energy*. The app reads calories from Apple Health, so the Lifesum integration comes for free once Health is connected. Steps, water and workouts come from the same place.

There are two ways in:

1. **iPhone app (native, best).** The Capacitor build reads HealthKit directly using [`@capgo/capacitor-health`](https://github.com/Cap-go/capacitor-health). It syncs when the app opens or comes back to the foreground, and when you tap the refresh button.
2. **Web app (works today).** A browser can't read HealthKit, so an iPhone **Shortcut** reads today's steps and dietary energy and posts them to Supabase (`ingest_health` RPC) with a private token. **Profile → Apple Health → Set up** walks through it and gives copy buttons for the URL, key and token. Run it with a *When Lifesum is closed* automation plus a few *Time of day* ones.

Both are optional. Everything can be typed in by hand.

## Setup

### 1. Supabase

1. In the [SQL editor](https://supabase.com/dashboard/project/vublvpjshnkybdilzcog/sql/new), paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then [`0002_pet.sql`](supabase/migrations/0002_pet.sql), [`0003_pet_style.sql`](supabase/migrations/0003_pet_style.sql) and [`0004_birthday.sql`](supabase/migrations/0004_birthday.sql). If the app ever says the database is missing a column, run [`0005_catch_up.sql`](supabase/migrations/0005_catch_up.sql): it adds anything from 0002–0004 that's missing, refreshes the API's schema cache, and is safe to run any number of times. [`0006_health_lookback.sql`](supabase/migrations/0006_health_lookback.sql) lets the Shortcut send the last few days (each with a `p_date`): steps keep the higher number, today's calories replace what's saved, and earlier days' calories keep the higher number. The migrations create `profiles`, `challenges` and `daily_logs` with row-level security, so each person only sees their own rows. It also creates the `ingest_health` function the Shortcut uses.
2. Under **Authentication → URL Configuration**, set the Site URL to wherever the app is hosted, so confirmation emails link back to it.
3. `.env` already holds the project URL and publishable key. Both are public by design, and row-level security protects the data. Put anything secret in `.env.local`, which git ignores.

Without keys the app still runs, but data is saved only on that device.

### 2. Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rules and Apple Health merge tests
npm run build      # static site in dist/
```

### 3. Put it on her phone (today)

Deploy `dist/` to any static host. On Vercel or Netlify that means: import the repo, set the build command to `npm run build`, the output directory to `dist`, (the committed `.env` supplies the Supabase settings). Then open the site in Safari and use **Share → Add to Home Screen**. It runs full-screen with its own icon.

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
  App.tsx                 tab shell (Today · Progress · Profile)
  screens/                Auth, Onboarding, Today, Progress, Profile
  components/             rings, toggles, steppers, bottom sheets, icons
  data/AppData.tsx        app state, optimistic saves (only changed fields are written)
  data/repo.ts            Supabase backend + on-device fallback
  lib/challenge.ts        75 Hard rules: day numbers, task checks, streaks, missed days
  health/                 HealthKit reader + merge rules (steps/water never go down,
                          Lifesum calories win unless typed by hand)
supabase/migrations/      schema, RLS, Shortcut endpoint
ios/                      Capacitor iOS project
```
