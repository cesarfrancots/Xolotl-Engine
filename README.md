# Agentic Game Engine

Tiny 2D engine slice for agent-driven game development.

See [docs/agent-contract.md](docs/agent-contract.md) for the machine-authoring contract and [docs/session-summary.md](docs/session-summary.md) for the latest session handoff.

```bash
npm run check
npm test
npm run verify
npm run solve
npm run dump-state
npm run describe
npm run schema
npm run template
npm run catalog
npm run trace
npm run simulate
npm run run
```

Open `http://127.0.0.1:5173/` and move with WASD or arrow keys.
The browser HUD shows status, scene, and score. Press `f` to toggle fullscreen; `Esc` exits native fullscreen.

Browser agent hooks:

- `window.render_game_to_text()` returns concise JSON state.
- `window.advanceTime(ms, actions)` advances deterministic 60 FPS simulation time with finite `ms >= 0`; `ms: 0` renders without stepping, positive `ms` advances at least one frame, and `actions` can be `{ right: true }` with boolean values, `["right"]`, `"right"`, or a test-style `{ actions: ["right"] }` step. Other action payloads throw, and action lists cannot contain duplicates. Test-style action objects may only contain `action` or `actions`; timing comes from the `ms` argument.
- `advanceTime` switches the runner to manual time so `requestAnimationFrame` cannot drift agent observations; call `window.setManualTime(false)`, press a movement key, or reset to resume live play.
- Browser scene load/validation failures keep the hooks alive and report `status: "error"` plus `error` in `render_game_to_text()`.

The useful agent surface is plain files:

- `scenes/*.json` for editable worlds
- `tests/*.json` for deterministic play assertions
- `src/core.js` for simulation
- `web/*` for rendering only

The exported core `step(state, actions, dt)` expects state from `createState`, rejects malformed runtime state/entity/action inputs, including bad scene labels, bad tile sizes, bad world dimensions, duplicate runtime entity ids, missing goals, or the wrong player count, before mutating state, and treats `dt: 0` as a no-op.
The exported `actionsFromList(list)` helper expects an array of unique action strings and returns the boolean action map used by `step`.
The exported `dumpState(state)` helper expects state from `createState` and returns the compact snapshot used by browser hooks, trace, solve, and tests.
The exported `runTest(scene, test, onStep)` helper runs one validated test spec and accepts an optional function callback for per-step trace entries.
Tests can use `seconds` or exact `frames`; omitting both advances one frame, explicit `seconds: 0` is a no-op, positive `seconds` advances at least one frame, and tests can assert `status`, `tick`, `score`, `messages`, and final `entities` fields.
Tests reject missing or invalid scene references, malformed or unknown top-level, step, and `expect` fields, invalid or duplicate action values, ambiguous action/timing fields, invalid timing fields, invalid expectation shapes/value types, non-empty and mutually exclusive expected-error arrays, and non-machine-friendly `expect.entities` ids, and can assert scene/test validation errors with `expect.validationErrors` or `expect.testErrors`.
Scene validation rejects malformed scene/world/entity shapes, unknown scene/world/entity fields, non-string, duplicate, or non-machine-friendly ids, non-string names/colors/backgrounds, non-integer grid sizes, off-world entities, kind-specific field misuse, invalid speeds/values/required scores, and player/goal overlap with solids or hazards.
Entities currently support player, solid, hazard, goal, collectible, and decor; hazards set status to `lost`, collectibles add to `score`, and goals can set `requiresScore`.
Snapshots expose `locked` for score-gated goals, and the browser draws locked goals with a muted fill and slash.
`npm run check` checks every `scenes/*.json` and reports all failures before exiting non-zero; `npm test` runs every `tests/*.json` plus CLI smoke tests for default `simulate` shorthand and runner serve-surface checks, then reports all failures before exiting non-zero.

`npm run describe` prints the machine-readable engine contract for agents, including scene validation rules, id patterns, schema metadata, expected entity field types, simulation command metadata, snapshot command metadata, browser runner metadata, and browser hook metadata.
`npm run schema` prints JSON Schema for scene and test authoring, including scene player/goal count constraints and `xXolotlValidation` annotations for engine-specific scene/test checks.
`npm run template` prints a valid starter scene; `npm run template -- test` prints a valid starter test.
`npm run catalog` summarizes every scene/test with validation, expected errors, test scene labels, and solver status; scene `ok` means valid and solvable, scene `valid` means validation-only, and malformed or unreadable files appear as `ok: false` items instead of aborting the report.
`npm run verify` prints one JSON health report for every scene and test, including per-file JSON read/parse failures.
`npm run solve` prints a JSON array of simulated win paths and actually reached goals; malformed or unreadable scene files appear as `ok: false` results instead of aborting the run.
`npm run dump-state` prints the default scene snapshot; `npm run dump-state -- scenes/coin_room.json` snapshots another scene.
`npm run trace` prints a JSON array of per-step test state for debugging fixtures, and reports malformed tests or unreadable referenced scenes as `ok: false` trace entries.
Fixed-arity commands such as `describe`, `schema`, `catalog`, `verify`, `template`, and `dump-state` reject extra arguments.
`npm run simulate` runs the default scene; `npm run simulate -- right:4,down:4` runs default-scene steps; `npm run simulate -- scenes/coin_room.json right:4,down:4` runs ad hoc custom-scene steps without creating a fixture and prints `ok: false` JSON for bad scene paths, malformed step specs, or runtime errors; JSON step specs must be a steps array or an object with only `steps`, and step JSON files go after an explicit scene path.
Use `right:4, down:4` shorthand in PowerShell to avoid JSON quote escaping; whitespace around separators is ignored.
`npm run run` starts the browser runner for the default scene; `npm run run -- scenes/coin_room.json --port 5200` starts another scene. The runner serves only `web/*`, `scenes/*`, and `src/*`; repo files such as `package.json`, `.git/*`, and `progress.md` return 403. Unknown run flags, invalid ports, and busy ports fail clearly instead of falling back to 5173.
CLI JSON file reads tolerate a UTF-8 BOM from Windows editors.
