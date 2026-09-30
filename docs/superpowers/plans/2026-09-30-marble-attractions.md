# Marble Attractions Implementation Plan

> Execute inline using superpowers:executing-plans and superpowers:test-driven-development. This corrects the user's rejected result within the already authorized game work.

**Goal:** Replace long uneventful runs with conspicuous reversing turns and large obstacles that change the passage continuously.

**Architecture:** Keep the shared deterministic course factory. Generate a route from straight and circular segments using arc length rather than world Z; build the lofted surfaces and obstacles along this route. Simulation, scene and cameras consume the same description. Retain the actual funnel and finish and the old course as a regression fixture.

**Tech Stack:** TypeScript, React, Three.js, cannon-es, Node tests. No new dependencies.

**Design:** The rejected course varied small offsets on a long straight silhouette. Replace it with three compact forms: a three-lane serpentine with two 180-degree turns, a descending full spiral, and two opposed loops at different heights. Every next race rejects seeds that repeat the previous form. Radii, mirroring, slope, event order and mechanism phases vary within each form. Use large alternating posts, rolling slopes, translating bumpers and three rotating gates, including a two-blade cross. A wide island fork offers two same-level passages; the old lower shortcut remains only in the legacy fixture. Shape remains fixed during a race; gates and bumpers move throughout it.

**Route contract:** `parameter` measures distance along the path. Progress uses nearest 3D projection to distinguish return lanes and stacked loops. Camera samples use actual world coordinates and an outward view direction. Every form finishes with heading 0 modulo 2π so the translated funnel and chute retain their physical finish behavior.

## Constraints

- Keep 1–8 equal spheres and names independent of physical setup.
- Use shared descriptor dimensions for displayed and colliding obstacles.
- Maintain downhill travel, intact floor triangles and catching rails.
- Keep roster, classic mode, visibility pause and explicit 75-second fallback.
- Assess actual screenshots and visible races as well as automated correctness.

### Task 1: Substantial geometry and moving mechanisms

- [x] Add behavioral tests for broad turning silhouette, actual rotating lane obstructions and physical deflection against an open-lane control. Confirm failure in the rejected version.
- [x] Build actual reversing turns in `lib/marble-path.ts` and shared surfaces and mechanisms in `lib/marble-park.ts`; reduce `lib/marble-layout.ts` to the exact legacy fixture.
- [x] Add seeded kinematic crossbars, shared bumper dimensions, both bumper position coordinates and actual angle snapshots in `lib/marble-race.ts`.
- [x] Run attraction and existing geometry/camera tests. Inspect floor orientation and route continuity before tuning simulation.

### Task 2: Visible scene and completed races

- [x] Render every crossbar and scaled bumper from the same descriptors; match frame angles and dispose resources in `lib/marble-scene.ts`.
- [x] Run natural race tests and measured seeds for small/full teams; reproduce and fix jams or escapes at their physical source.
- [x] Inspect several visibly different courses in the local browser and run two ordinary races, capturing course and close views.
- [x] Run full tests, type check, changed-file lint, static build and diff checks.
- [x] Record current evidence, commit changes, update the original feature branch and show the improved local version.
