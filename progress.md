Original prompt: the goal will be to implement your idea thats achievable and then grow it slowly, how does that sound?

Progress:
- Built the first text-first engine slice: JSON scene, deterministic core, CLI checks/tests, and browser canvas runner.
- Next useful step: expose browser hooks so agents can inspect and advance the game deterministically.
- Added browser hooks: `window.render_game_to_text()` and `window.advanceTime(ms)`.
- Browser smoke found only an implicit favicon 404; fixed with a data favicon.
- Verified browser hook smoke in installed Chrome: `advanceTime(1000)` moved player x from 1 to 5 with no console errors.
- Added stricter test expectations for final entity fields and messages.
- Added a collision regression fixture and let the CLI run multiple test specs in one command.
- Tightened `reach_exit` around actual overlap behavior: win triggers when the player first overlaps the goal.
- Updated `advanceTime(ms, actions)` so agents can pass explicit input instead of relying on live keyboard state.
- Verified explicit browser stepping: `advanceTime(1000, { right: true })` moves player from x=1 to x=5 with no console errors.
- Added `npm run describe` so agents can inspect supported actions, entity kinds, scene fields, and test fields.
- Made `check` and `test` discover all JSON files by default, so new scenes/fixtures are automatically covered.
- Added `npm run trace` for per-step fixture state, and fixed `run` after CLI arg discovery changed.
- Fixed `dumpState` snapshots so trace steps do not share the live messages array.
- Made `trace` emit one JSON array so agents can parse multi-fixture output directly.
- Added exact `frames` test steps and `expect.tick`, then moved current fixtures off decimal seconds.
- Verified browser smoke after frame/tick changes. The skill Playwright script still cannot run from project Node because local `playwright` is not installed; Node REPL Playwright + installed Chrome works.
- Added scene bounds validation and a validation-error fixture so AI-authored scenes cannot place entities off-world unnoticed.
- Added `npm run verify`, a single JSON gate covering all scene validation and all test fixtures.
- Added `npm run solve`, a small grid solver that verifies generated win paths through the real simulation.
- Verified solver output: it finds the two-step `right`/`down` route for `level_01` and `verify` now includes that playable solution.
- Added validation for player/goal overlap with solids and a fixture proving the error shape.
- Verified overlap validation through `verify`, `test`, `solve`, `trace`, and browser smoke.
- Added validation for invalid `speed` values and a fixture proving the error shape.
- Verified speed validation through `verify`, `check`, `test`, `describe`, `solve`, `trace`, and browser smoke. The skill Playwright client still lacks local `playwright`; Node REPL Playwright + installed Chrome works.
- Added a `hazard` primitive, a losing fixture, and a hazard scene that proves the solver routes around danger.
- Added a `collectible` primitive, score expectations, a coin room scene, and validation for invalid collectible values.
- Verified collectibles through `verify`, `check`, `test`, `describe`, `solve`, `trace`, and browser smoke. The skill Playwright client still lacks local `playwright`; Node REPL Playwright + installed Chrome works.
- Added score to the browser HUD so the visible game state matches `render_game_to_text`.
- Verified HUD score with `verify`, `test`, and browser smoke: coin pickup changes both HUD and text state from score 0 to 5.
- Added score-gated goals with `requiresScore`, including a locked-exit scene, blocked/win fixtures, validation for invalid required scores, and solver routing through enough collectible value before ending.
- Verified locked exits through `verify`, `check`, `test`, `describe`, `solve`, `trace`, and browser smoke. The skill Playwright client still lacks local `playwright`; Node REPL Playwright + installed Chrome works.
- Added `npm run schema`, which prints JSON Schema for scene and test authoring so agents can inspect valid JSON shapes before writing files.
- Verified schema output with `schema`, a small contract assertion, `verify`, `check`, `test`, `describe`, and browser smoke. The skill Playwright client still lacks local `playwright`; Node REPL Playwright + installed Chrome works.
- Added explicit `locked` snapshot state for score-gated goals and rendered locked goals with a muted fill plus diagonal slash.
- Fixed test entity expectations to assert against `dumpState`, matching the snapshot surface agents and traces consume.
- Verified locked goal snapshots/visuals through `verify`, `check`, `test`, `describe`, `schema`, `solve`, `trace`, and browser smoke. The skill Playwright client still lacks local `playwright`; Node REPL Playwright + installed Chrome works.
- Added `simulate`, an ad hoc CLI runner for scene steps from a fixture file, JSON in shells that preserve quotes, or quote-safe shorthand such as `right:4,down:4`.
- Verified `simulate` with no-step, fixture-file, blocked shorthand, and win shorthand runs, then rechecked `verify`, `check`, `test`, `describe`, `schema`, `solve`, `trace`, and browser smoke. The skill Playwright client still lacks local `playwright`; Node REPL Playwright + installed Chrome works.
- Added `template`, which prints valid starter scene/test JSON for agents to edit instead of reconstructing file shapes from memory.
- Verified templates with direct CLI output, a core assertion that the scene validates and test steps win, `verify`, `check`, `test`, `describe`, `schema`, `solve`, `trace`, and browser smoke. The skill Playwright client still lacks local `playwright`; Node REPL Playwright + installed Chrome works.
- Added `catalog`, a JSON project map that summarizes every scene/test with validation, entity counts, goal requirements, and solver status.
- Verified catalog through `catalog`, `verify`, `check`, `test`, `describe`, `schema`, `solve`, `trace`, and browser smoke. The skill Playwright client still lacks local `playwright`; Node REPL Playwright + installed Chrome works.

TODO:
- Add the next engine primitive only when a scene/test needs it; current useful primitives are player, solid, hazard, goal, collectible, decor.
