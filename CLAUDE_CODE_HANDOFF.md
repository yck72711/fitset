# FITSET — Handoff to Claude Code

Paste this whole file as your first message to Claude Code after opening this
folder, so it has full context without re-deriving anything.

---

## What this is

FITSET is a single-file vanilla HTML/CSS/JS fitness app (`index.html`,
~4,000 lines — no framework, no build step) with a Node serverless function
(`api/chat.js`) for the AI Coach, deployed on Vercel. User accounts and
cross-device sync run through Supabase.

**Read `index.html` in full before editing anything — it's one big file with
everything inline.**

## Folder structure

```
fitset-deploy/
  index.html       ← the whole app
  api/chat.js       ← serverless function, proxies to Anthropic (holds the API key)
  package.json
  README.md         ← original deploy instructions (still accurate)
```

## Tech / deployment

- **Hosting:** Vercel. Deploy with `vercel --prod` from this folder.
- **AI Coach:** calls `/api/chat`, which server-side calls Anthropic's
  `/v1/messages` with `ANTHROPIC_API_KEY` from a Vercel environment variable
  (never in the HTML). Model: `claude-sonnet-4-20250514`.
- **Accounts/database:** Supabase project `lsxncpgajqckafvwnhpo`.
  - Project URL: `https://lsxncpgajqckafvwnhpo.supabase.co`
  - Publishable key (safe client-side, already in `index.html`):
    `sb_publishable_RiUwZsmkF-o7BWh8bz1zPg_ZLVm9JXg`
  - Table: `Fitset` — columns `id` (uuid), `user_id` (uuid, default
    `auth.uid()`), `name` (text), `data` (jsonb), `created_at` (timestamptz)
  - RLS policy: `auth.uid() = user_id`, covers ALL operations
  - The Supabase JS client is loaded from
    `cdn.jsdelivr.net/npm/@supabase/supabase-js@2` — **this means the AI
    Coach and login system both require a real internet connection and a
    real `https://` origin.** Opening `index.html` locally via `file://`
    will show "Failed to fetch" on login/signup — that's expected, not a
    bug. Only test auth/AI Coach on the deployed Vercel URL.

## Feature inventory (all built and working)

**Core:** My Routines, Builder (exercise library + routine panel), Workout
engine (timers, rep counting incl. camera-based motion detection), Routine
Preview, Complete/summary page.

**Exercise database:** ~280 exercises in `const EX = [...]`. Equipment
categories: Barbell, Dumbbell, Cable, Machine, Kettlebell, No Equipment
(single merged category — don't reintroduce "Bodyweight" as separate).

**Rounds:** routines can repeat 1–10x, tracked through the workout engine
with a "Round X of Y" overlay.

**Rehab Mode:** injury-specific rehab programs (currently only
`ankle_ligament_sprain` implemented; data model is generic for adding more),
phase-based progression (4 phases, manual advance only), pain/swelling
check-ins, reuses the workout engine for rehab sessions. AI Coach gets
rehab-aware context + hard safety guardrails in its system prompt whenever a
rehab program exists (never diagnoses, never clears for return to sport).
Accessible only from the sidebar, not top nav.

**AI Coach:** full chat with conversation history, can propose a routine
that the user saves directly to My Routines via a save button on the
message bubble.

**Accounts (Supabase):** sign up / sign in / sign out modal (matches app's
existing modal design). `localStorage` stays the synchronous source of
truth for routine data; when logged in, every `persistRoutines()` call also
fires an async push to Supabase in the background (see `syncRoutinesToCloud()`).
Logging in triggers `migrateLocalRoutinesToCloud()` once, so routines built
before signing up aren't lost. Sign-in modal auto-opens (floating, centered)
for logged-out visitors after the motivation popup closes. Profile button
in the mobile dock is always visible — shows sign-in form if logged out,
account info if logged in.

**Mobile responsiveness:** single `@media (max-width:680px)` breakpoint
handles everything — desktop/tablet layout is completely untouched above
that width. Key mobile-only elements:
- Floating "Dynamic Island"-style bottom dock (`#floatingDock`): theme
  toggle, My Routines, Builder, AI Coach, Profile. Auto-hides on
  Workout/AI Coach pages (they have their own bottom controls).
- Top nav's Dark/Light toggle and page tabs hidden on mobile (redundant
  with dock + hamburger sidebar).
- Builder's muscle-group/equipment filters become a dropdown-list "filters
  card" (dashed border, icon labels) instead of desktop's chip rows — this
  design was later made universal (desktop uses the same filter card now,
  chip rows were fully removed from the codebase).
- "Target Area" sub-filter (e.g. Upper/Lower/Inner/Outer Chest) is
  **derived dynamically** from each exercise's `muscle` field — not
  hand-tagged. See `getSubRegionsForGroup()`.

**Sound alerts:** Web Audio API-generated tones (no external files) — 3-2-1
countdown beeps + a distinct completion chime for both timed exercises and
rest periods. Volume slider popup (not a binary mute) on the workout
controls row, persists to `localStorage`.

**Landing/intro page:** shown automatically to first-time visitors only
(`localStorage.fitsetVisited` flag), returning visitors go straight to My
Routines. Space (spacefs.com)-inspired design: generous whitespace, one
feature per bordered box, no CTAs in the hero. Two **live, scroll-triggered
simulations** (not static screenshots) built with `IntersectionObserver`:
  - Build simulation: exercise cards cascade in with staggered CSS
    transitions, landing in a live "My Routine" preview panel.
  - Run simulation: a real countdown ring + exercise queue state machine
    that pauses when scrolled out of view (see the IIFE near the bottom of
    the `<script>` block, right before the app's init sequence).
  AI Coach section is intentionally minimal — just a headline + badge, no
  marketing paragraph (this was a deliberate request). All primary CTAs
  ("Build Your First Routine", "See My Routines") live in one closing
  section at the very bottom, not the hero.

## Known non-issues (don't "fix" these)

- "Failed to fetch" when testing locally via `file://` — expected, Supabase
  rejects `null`-origin requests. Only resolves on a real deployed URL.
- Full-page screenshots (e.g. from testing tools) show the floating mobile
  dock overlapping mid-page content — that's a screenshot-stitching
  artifact from capturing a `position:fixed` element across a scrolled
  capture, not a real rendering bug during normal use.

## Working style (carry this forward)

- Confirm your approach before writing code for anything nontrivial.
- Test by actually reasoning through code paths / running things, not just
  eyeballing.
- Don't add scope beyond what's asked.
- Keep the single-file constraint — no build step, no bundler, no
  frameworks. If a change would require one, flag it and ask first.

## What I want to work on next

[FILL THIS IN]
