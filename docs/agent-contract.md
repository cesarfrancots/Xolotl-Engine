# Xolotl Agent Contract

Xolotl is a dependency-free JSON scene engine for deterministic, AI-authored 2D game slices. The stable surface is intentionally small: author JSON, validate it, run deterministic steps, solve/check reachability, and render in the browser demo.

## Scene JSON

Scenes live in `scenes/*.json` and are plain data:

- `name`: non-empty scene label.
- `tileSize`: positive integer.
- `world`: positive integer `width` and `height`, plus optional string `background`.
- `entities`: rectangles with unique machine-friendly `id`, `kind`, numeric `x`, `y`, `w`, and `h`.

Supported `kind` values are `player`, `solid`, `hazard`, `goal`, `collectible`, and `decor`.

Important validation rules:

- Exactly one `player` entity is required.
- At least one `goal` entity is required.
- Entity ids must be unique and machine-friendly.
- `w` and `h` must be positive finite numbers, and all entities must start inside the world.
- `speed` is only valid on `player`.
- `value` is only valid on `collectible`.
- `requiresScore` is only valid on `goal` and must be non-negative.
- Player and goal entities cannot overlap solids or hazards at scene start.

## Test JSON

Fixtures in `tests/*.json` use a scene reference, deterministic steps, and expected final state:

```json
{
  "scene": "scenes/level_01.json",
  "steps": [
    { "actions": ["right"], "frames": 4 }
  ],
  "expect": {
    "status": "playing"
  }
}
```

Each step may use `frames`, `seconds`, or omit both for one frame. `seconds: 0` is a no-op, while positive seconds advance at least one frame. Tests can assert `status`, `tick`, `score`, `messages`, and final `entities` snapshot fields.

Expected validation failures are represented with `expect.validationErrors` for bad scenes or `expect.testErrors` for bad test files. The CLI strips UTF-8 BOMs before parsing JSON.

## CLI Contract

Run commands through `npm.cmd run <script>` on Windows or `npm run <script>` elsewhere.

- `describe`: emits the machine-readable engine contract.
- `schema`: emits scene/test JSON schemas plus Xolotl validation notes.
- `template`: prints a minimal scene or test template.
- `verify`: validates repository scenes and tests with per-file JSON failures.
- `check`: validates and dry-runs every scene.
- `test`: runs JSON fixtures plus CLI smoke tests.
- `solve`: searches deterministic win paths for bundled scenes.
- `catalog`: summarizes scene/test validity and solver status.
- `trace`: prints per-step deterministic state.
- `simulate`: applies ad hoc inputs and prints final state.
- `dump-state`: prints normalized initial state.
- `run`: starts the browser runner.

## Solver Expectations

The solver should prefer reachable progress. For score-gated goals it must choose reachable collectibles that satisfy `requiresScore` instead of blindly following collectible id order. Regression scenes cover unreachable decoy collectibles.

## Browser Contract

The browser runner is in `web/` and uses the same core engine as the CLI. It exposes:

- `window.render_game_to_text()`: stable text snapshot for smoke checks.
- `window.advanceTime(ms, actions)`: deterministic time advancement for tests.

The runner only serves files below `web/`, `scenes/`, and `src/`.

## Session Gate

Before pushing non-trivial engine logic, run:

```powershell
npm.cmd test
npm.cmd run verify
npm.cmd run check
npm.cmd run solve
npm.cmd run catalog
```

Use a smaller targeted command when the edit is docs-only.
