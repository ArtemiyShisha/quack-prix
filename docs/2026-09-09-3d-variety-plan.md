# Longer, faster marble course

User-authorized iteration: plain coloured marbles, added course variety rather than stretched straights, quicker rolling, and clear views of the funnel and finish. Preserve roster, classic mode, equal-body physics and a soft race duration.

- Remove DOM labels and numbered textures. Match roster swatches to the exact marble palette.
- Extend the downhill course from z=80 to z=106 with a gentle wave section and extra alternating turns; increase slope/gravity together while retaining the same funnel entry height. Extend the finishing chute to z=134.
- Derive outlet, backstop and finish positions from track constants. Verify natural completion for 1–8 players and no escapes.
- Fit overview to geometry and aspect ratio. Follow from above/downstream so the approach does not hide the funnel. Show the whole finale before entry, and keep the result below the canvas.
- Add camera projection and occlusion regression checks. Run existing physics tests, sampled complete races, type check, build, read-only review, then publish to the existing Site and sync the project.

Completed: 34 tests and build pass; 16 complete races finish naturally without escapes (37.62–46.59 s). Camera fit and opaque-geometry ray tests pass. Read-only review found no consequential issues. See docs/3d-verification.md.
