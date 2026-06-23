# Agentic Game Engine

Tiny 2D engine slice for agent-driven game development.

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
The browser HUD shows status, scene, and score.

Browser agent hooks:

- `window.render_game_to_text()` returns concise JSON state.
- `window.advanceTime(ms, actions)` advances deterministic 60 FPS simulation time.

The useful agent surface is plain files:

- `scenes/*.json` for editable worlds
- `tests/*.json` for deterministic play assertions
- `src/core.js` for simulation
- `web/*` for rendering only

Tests can use `seconds` or exact `frames`, and assert `status`, `tick`, `score`, `messages`, and final `entities` fields.
Tests can also assert scene validation errors with `expect.validationErrors`.
Scene validation rejects off-world entities, invalid speeds/values/required scores, and player/goal overlap with solids.
Entities currently support player, solid, hazard, goal, collectible, and decor; hazards set status to `lost`, collectibles add to `score`, and goals can set `requiresScore`.
Snapshots expose `locked` for score-gated goals, and the browser draws locked goals with a muted fill and slash.
`npm run check` checks every `scenes/*.json`; `npm test` runs every `tests/*.json`.

`npm run describe` prints the machine-readable engine contract for agents.
`npm run schema` prints JSON Schema for scene and test authoring.
`node bin/engine.js template scene|test` prints valid starter JSON.
`npm run catalog` summarizes every scene/test with validation and solver status.
`npm run verify` prints one JSON health report for every scene and test.
`npm run solve` prints a simulated win path for every scene it can solve.
`npm run trace` prints a JSON array of per-step test state for debugging fixtures.
`node bin/engine.js simulate <scene> [steps-json|steps-file|right:4,down:4]` runs ad hoc steps without creating a fixture.
Use the `right:4,down:4` shorthand in PowerShell to avoid JSON quote escaping.
