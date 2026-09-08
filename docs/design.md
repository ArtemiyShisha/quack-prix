# Кряк-при

Approved scope, 8 September 2026: one physical obstacle course, up to eight named people, a rolling duck for each, and the first duck to finish chooses the daily meeting host. Participation over multiple devices is explicitly deferred. First version is operated on one browser.

The roster starts empty, is editable before each race, and persists only in localStorage on that browser. One to eight nonempty names are supported. Absent people can be unticked. Duplicate names are rejected without deleting input. Names never enter physics calculations.

Independent fresh randomness controls a uniform participant-to-body shuffle and the physical initial conditions (start jitter, impulses, rotor phases). Identical duck bodies are created in slot order; assigning identities afterward makes each participant equally likely to occupy any physical trajectory. No winner is selected before the simulation. Consecutive wins remain possible.

The track has staggered pegs, spinning paddles, and a narrowing final chute. After the user requested a longer race, the course was extended to 1760 units with three alternating ramps, four rotors and a final chute. The camera follows the leader, with a whole-course overview toggle. It runs with a fixed physics timestep, independent of frame rate. The first interpolated downward crossing wins; simultaneous crossings use an identity-independent tie rank. A common flush opens obstacles after 32 seconds. At 40 seconds an explicitly labelled distance result is used if no duck finished; exact distance ties use the same independent rank. Timer counts active simulation time and pauses with the tab.

Visual direction: toy water park in bright cyan, white pool tiles, navy ink, tangerine controls, and a glossy round duck sprite recoloured at render time. The extended course is the main surface; a compact roster sits beside it. The names remain upright while the ducks rotate. Mobile stacks the roster and the scrolling track viewport.

Validation: deterministic simulation runs, identity permutation invariance, fast finish crossing, all 1–8 player counts, bounded race duration, fresh random setup, roster validation/storage failures, TypeScript and production build. Document known limitations rather than promising that a finite distribution test proves fairness.
