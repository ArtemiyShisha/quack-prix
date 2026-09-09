# Кряк-при — current design

One browser-operated race for up to eight named participants; first finisher hosts the daily meeting. Preserve local roster/attendance, independent uniform identity shuffle, sound, overview, pause, restart and optional WebMCP.

The user likes the natural marble-run physics but wants more variety than four bowls. Preserve the first and last bowls and replace the middle with distinct downhill geometry: a two-arm fork around a rounded island, then a zigzag cascade with two sloping ledges. A hinged splitter at the fork and two pendulums in the cascade move smoothly with independently seeded phases. Their exact poses feed both Matter collision bodies and the SVG.

The shared discriminated stage model defines circles for bowls and convex outlines for chutes, with a constantly open exit on every stage. Bowl gravity is radial; chute gravity is constant downhill. Neither uses rank-dependent forces, holding timers or random in-race impulses. Local wall penetration correction complements Matter contacts. The initial cascade's shallow ledges caused excessive slow rolling; steeper ledges and a stronger constant slope restored pace. Exit locations sit inside the bottom funnel's collection region.

The connecting tubes are constrained rails. Segment–circle interpolation determines physical drain arrival time, including simultaneous arrivals within a tick. Immutable arrival time and independent tie ranks preserve order; tube spacing extends into an invisible vertical entry beneath the drain. Bodies in tubes do not collide with surface bodies. Re-entry velocity derives from the prior energy plus the fixed drop, with direction following the tube. The first duck to complete the final tube crosses the visible finish.

Physics uses a fixed 1/60-second timestep. Race progress compares stage, radial approach in bowls or downhill progress in chutes, and tube position; this is an ordering aid, not a prediction of the eventual winner. The camera follows the leading bowl, downhill duck or transit and includes the final finish. The full-course view remains available.

Identical bodies receive a fresh independent assignment of names for every race. Physics never sees names or roster identities. Fresh setup and pendulum phases vary the outcome; repeated winners remain possible. Roughly 30 seconds is a soft pacing target. Shared emergency rescue at 50 seconds and explicit distance fallback at 60 remain.

Toy water-park appearance: pale tiled floor, curved transparent channels, shaded bowls, mint fork, blue cascade, warm island and ledges, dark open drains, subtle contour lines, glossy coloured ducks, upright name pills. Remove event flashes, explosion rings, boost trails and geyser messaging.

Validation covers smooth free motion, actual orbits/contact, always-open drains, downstream geometry, crossing/queue order, collision isolation, fair shuffle, all counts, reproducibility, finite bounded states, duration/freeze, types and build. Statistical checks are evidence about sampled runs, not proof of subjective feel or guaranteed overtakes. Browser interaction/visual QA only when explicitly requested.


## Additional 3D mode — 9 September

The new `/3d` route is an alternative alongside `/`, sharing roster and independent identity assignment. Cannon-es sphere bodies roll in full 3D under uniform gravity along a raised serpentine, pass moving bumpers, fork around a solid island, pass an offset paddle, enter a bowl with an open centre, and drop onto a separate low-walled finish chute. All collision triangle data feeds Three.js directly. Uniform funnel damping, with no dependence on rank or elapsed time, dissipates orbits; moving colliders affect balls only on contact.

A perspective follow camera and rotatable overview show elevation, support legs and soft shadows. Striped numbered marbles use the roster colours; existing duck images accompany names. A pure 2D placement function resolves labels around dense packs in all directions without forcing overlaps. No WebGL falls back to a classic-route link; unavailable rendering pauses the race. New physical crossing checks require actual outlet clearance and interpolation through the marked finish opening. The emergency bound is 75 seconds for 3D, without changing classic timing or simulation.
