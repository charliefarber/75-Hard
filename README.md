# 75 Hard

A simple, good-looking daily tracker for the 75 Hard challenge. It's styled after Lifesum's forest green, and it's built as a React app that ships as a website now and as an iPhone app later.

**What it tracks each day**

| Task | How it's logged |
| --- | --- |
| Workout 1 and 2 (45 min each, one outdoors) | Tap to log type, length and outdoors, or auto-filled from Apple Health workouts |
| Water (1 gallon: 3.8 L US, or 4.5 L UK) | +250 / +500 ml buttons; also picks up water logged in Lifesum |
| Read 10 pages | Page stepper |
| Follow a diet, no cheat meals | Toggles |
| No alcohol | Toggle |
| 10,000 steps (optional, on by default) | Apple Health, the iPhone Shortcut, or typed in |
| Calories | Lifesum, through Apple Health, or typed in (shown against the calorie target, not pass/fail) |

The progress picture is left out on purpose. There's also a notes box for each day.

When a past day isn't complete, Today flags it. You can fix the log if you did the tasks, or restart at day 1, which is what the rules say. Restarting keeps all history. If you're already partway through when you sign up, choose **Underway** and the earlier days count as done.

## Lifesum and Apple Health

Lifesum has no public API, but it writes the food you log to **Apple Health** as *Dietary Energy*. The app reads calories from Apple Health, so the Lifesum integration comes for free once Health is connected. Steps, water and workouts come from the same place.

There are two ways in:

1. **iPhone app (native, best).** The Capacitor build reads HealthKit directly using [`@capgo/capacitor-health`](https://github.com/Cap-go/capacitor-health). It syncs when the app opens or comes back to the foreground, and when you tap the refresh button.
2. **Web app (works today).** A browser can't read HealthKit, so an iPhone **Shortcut** reads today's steps and dietary energy and posts them to Supabase (`ingest_health` RPC) with a private token. **Profile → Apple Health → Set up** walks through it and gives copy buttons for the URL, key and token. Run it with a *When Lifesum is closed* automation plus a few *Time of day* ones.

Both are optional. Everything can be typed in by hand.

## Setup

### 1. Supabase

1. In the [SQL editor](https://supabase.com/dashboard/project/vublvpjshnkybdilzcog/sql/new), paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It creates `profiles`, `challenges` and `daily_logs` with row-level security, so each person only sees their own rows. It also creates the `ingest_health` function the Shortcut uses.
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
