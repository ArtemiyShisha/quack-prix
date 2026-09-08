# Кряк-при

Approved scope, 8 September 2026: one physical obstacle course, up to eight named people, a rolling duck for each, and the first duck to finish chooses the daily meeting host. Participation over multiple devices is explicitly deferred. First version is operated on one browser.

The roster starts empty, is editable before each race, and persists only in localStorage on that browser. One to eight nonempty names are supported. Absent people can be unticked. Duplicate names are rejected without deleting input. Names never enter physics calculations.

Independent fresh randomness controls a uniform participant-to-body shuffle and the physical initial conditions (start jitter, impulses, rotor phases). Identical duck bodies are created in slot order; assigning identities afterward makes each participant equally likely to occupy any physical trajectory. No winner is selected before the simulation. Consecutive wins remain possible.

The current track is a 1960-unit water park with a split slide, moving pinball bumpers and a six-spoke rotor, two pulsing turbo ramps, inclined sliding sluices, and a final funnel. Moving positions and seed-driven pulses are shared with SVG rendering. Contact kicks have a short per-body cooldown; identical force rules apply to every physical slot. Inclined sluices carry ducks toward their opening instead of trapping them on horizontal shelves.

The camera follows the leader, with a whole-course overview toggle. Physics uses a fixed 1/60-second timestep. The first interpolated downward crossing wins; simultaneous crossings use an identity-independent tie rank. Roughly 30 seconds is a pacing target, explicitly not a deadline. A common rescue flush opens obstacles only after a long race reaches 40 seconds. At 48 seconds an explicitly labelled distance result is used if no duck finished. The timer pauses with the tab.

Visual direction: toy water park in bright cyan, white pool tiles, navy ink, tangerine controls, and a glossy round duck sprite recoloured at render time. The extended course is the main surface; a compact roster sits beside it. The names remain upright while the ducks rotate. Mobile stacks the roster and the scrolling track viewport.

Validation: deterministic simulation runs, identity permutation invariance, fast finish crossing, all 1–8 player counts, bounded race duration, fresh random setup, roster validation/storage failures, TypeScript and production build. Document known limitations rather than promising that a finite distribution test proves fairness.
