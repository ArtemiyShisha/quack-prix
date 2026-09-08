# Dynamic course update

User-approved scope: make the existing duck course more varied and dynamic while aiming for a round on the order of 30 seconds, not a strict deadline. Retain 1–8 participants, the saved roster, independent random identity assignment and physics-determined finishes.

- Replace the three similar long ramps with a split slide, moving pinball bumpers, two turbo ramps and oscillating final sluices. Keep a short final funnel and one continuous course.
- Shared geometry describes rendering and collisions. Fresh physical seed controls moving-obstacle phases and jet pulses; never use names or roster order in forces.
- Keep the existing countdown. Tune the physical course around 20–35 seconds. The user explicitly clarified that 30 seconds is only a pacing target. Give normal races more room: emergency flush at 40 seconds and fallback at 48 seconds. Label any distance-based fallback. Hidden-tab pause remains explicit.
- Test physical movement, bumper kicks, position-triggered boost force, all participant counts, first finish, determinism and the forced-jam fallback. Use a seeded sweep to measure actual durations and whether different route choices change the leader.
- Update the existing SVG renderer and hints around actual motion, using the existing duck asset and palette. Retain the continuous preview tab.
- Build and publish to the same owner-private Site after validation; synchronize the verified changes into the user's project only if its checkout remains unchanged.
