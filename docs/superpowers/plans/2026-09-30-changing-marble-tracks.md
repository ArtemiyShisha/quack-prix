# Changing Marble Tracks Implementation Plan

> Execute inline using superpowers:executing-plans and superpowers:test-driven-development. The user has selected and authorized this design.

**Goal:** Generate a visibly different, physically traversable 3D marble course before each race.

**Architecture:** Parameterize the existing shared course geometry into a deterministic factory. Physics, renderer and camera consume its per-race description; frames carry only its seed. Preserve the old course as an explicit regression fixture.

**Tech Stack:** TypeScript, React, Three.js, cannon-es, Node test runner, existing vinext/Vite builds.

**Spec:** ../specs/2026-09-30-changing-marble-tracks-design.md

## Global Constraints

- Node.js >=22.13.0; no new dependencies.
- 1–8 equal physical marbles; names shuffled independently of course seed.
- Generate between races; geometry stays fixed during each race.
- Preserve classic mode, roster, colors, visibility pause and 75-second fallback.
- Reuse the generated mesh for physics and rendering; release old scenes.
- Target 45–60 seconds, measured rather than imposed by a timer.

### Task 1: Deterministic course factory

Files: `lib/marble-track.ts`, new `lib/marble-layout.ts`, `tests/marble-generation.test.ts`.

Produces: `createMarbleCourse(seed: number): MarbleCourse`, `LEGACY_MARBLE_COURSE`, descriptors for named sections and all existing mesh/center/obstacle fields.

- [x] Add tests that catch fixed geometry across seeds, nondeterministic regeneration, mismatched sections and upward slopes. Compare mesh vertex arrays and section kinds; sample every unit of course height.
- [x] Run `node --test tests/marble-generation.test.ts`; confirm failures before implementation.
- [x] Extract the old builder into a course factory with per-seed lengths, turns, section order, waves, pegs, bumpers, shortcut side and obstacle speeds. Keep the legacy exports sourced from `LEGACY_MARBLE_COURSE`.
- [x] Run the generation tests and existing camera tests. Check that legacy geometry still passes.

### Task 2: Shared per-race physics and cameras

Files: `lib/marble-race.ts`, `lib/marble-camera.ts`, `tests/marble.test.ts`, `tests/marble-events.test.ts`, `tests/marble-generation.test.ts`.

Consumes: `MarbleCourse`. Produces: `new MarbleSimulation(count, seed, course?)`, public `course`, `MarbleFrame.courseSeed`.

- [x] Add a test asserting new seeds produce different physical courses and complete natural races. Add projection tests for generated course bounds in desktop/portrait views.
- [x] Run the new tests to demonstrate missing simulation/camera integration.
- [x] Replace fixed imports in simulation with instance course fields; derive progress, stage transitions and finish from the current geometry. Accept explicit legacy course in the old geometry-focused tests.
- [x] Make camera functions accept the current course, caching sampled points per course.
- [x] Run all tests and measure several seeds across 1–8 marbles; investigate stalls/escapes before adjusting bounds.

### Task 3: Scene replacement and reviewable game

Files: `lib/marble-scene.ts`, `components/marble-track.tsx`, `README.md`, measurement report.

Consumes: frame seed. Produces: new course rendered for every start, matching physical obstacles, fitted cameras and a current-course caption.

- [x] Pass the generated course into scene creation; scope meshes and camera poses to it. Dispose WebGL resources on replacement.
- [x] Derive the React course with `useMemo` from `courseSeed`; rebuild only when the seed changes. Use a fixed generated preview before the first start.
- [x] Display route name and the new-course-per-race behavior in product language.
- [x] Run `npm test`, `npx tsc --noEmit`, `npm run build:pages`, `git diff --check`.
- [x] Open the local game, enter participants, run two races, inspect different tracks, finish results and both routes. Capture screenshots and check browser errors.
- [x] Document actual measurements and prepare the tested build.
- [ ] Transfer the verified branch into the original project after checking its clean baseline.
