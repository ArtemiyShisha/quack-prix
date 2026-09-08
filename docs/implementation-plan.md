# Кряк-при Implementation Plan

**Goal:** A usable one-track duck race for choosing a daily host among one to eight entered names.

**Architecture:** React UI owns roster and race lifecycle. A renderer-independent fixed-step Matter.js simulation owns physical slots and finishing order. Independently shuffled participant IDs map physical slots to names only in the UI. SVG renders the same physics bodies and obstacles.

**Tech stack:** Generated Vinext/React/TypeScript Sites starter, installed Shadcn Input/Button, Matter.js, Node test runner, SVG, browser storage.

- [x] Build a recognizable first slice in `app/page.tsx`, `app/globals.css`, `components/race-track.tsx`; use the generated duck sprite in `public/duck.png`. Open the successfully compiled local route.
- [x] Test unbiased bounded sampling with a sequence beginning at `0xffffffff`, Fisher–Yates permutation membership, whitespace/duplicate/over-capacity roster errors, and corrupted storage. Implement `lib/random.ts` and `lib/roster.ts` only after the tests fail.
- [x] Test `new RaceSimulation(count, seed)` for 1–8 physical slots, deterministic physical results, identity-independent mapping, segment finish interpolation, and frozen result after the first crossing. Implement `lib/race.ts` and `lib/track.ts` with equal circle bodies, pegs, rotating capsules, and final narrowing rails.
- [x] Simulate many independent seeds for every supported count, collect natural finish / timeout counts and duration bounds; adjust the shared physical track if needed, without modifying identity assignment or preselecting a winner.
- [x] Connect `components/race-track.tsx` to fixed-step animation and lifecycle callbacks. Integrate editable/active roster, validation, local persistence, countdown, mute, winner panel, and another race in `app/page.tsx`.
- [x] Add a bounded imperative WebMCP surface for roster setup and race start using the same validation/lifecycle.
- [x] Run `node --experimental-strip-types --test tests/*.test.ts`, `npx tsc --noEmit`, and `npm run build`. Have an independent reviewer inspect fairness and lifecycle source. Resolve actionable findings.
- [x] Commit the verified source, privately publish the same build through Sites, verify the terminal deployment state, and copy the finished project into the user's projects folder without overwriting existing files.
