const KINDS = new Set(["player", "solid", "hazard", "goal", "collectible", "decor"]);
const ACTIONS = new Set(["left", "right", "up", "down"]);
const STATUSES = new Set(["playing", "won", "lost"]);
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ID_PATTERN_TEXT = "letters, numbers, _, or -";
const SCENE_FIELDS = new Set(["name", "tileSize", "world", "entities"]);
const WORLD_FIELDS = new Set(["width", "height", "background"]);
const ENTITY_FIELDS = new Set(["id", "kind", "x", "y", "w", "h", "speed", "value", "requiresScore", "color"]);
const RUNTIME_ENTITY_FIELDS = new Set([...ENTITY_FIELDS, "collected"]);
const TEST_FIELDS = new Set(["scene", "steps", "expect"]);
const STEP_FIELDS = new Set(["action", "actions", "seconds", "frames"]);
const EXPECT_FIELDS = new Set(["status", "tick", "score", "messages", "entities", "tolerance", "validationErrors", "testErrors"]);
const SNAPSHOT_ENTITY_FIELD_TYPES = {
  id: "string",
  kind: "string",
  x: "number",
  y: "number",
  w: "number",
  h: "number",
  value: "number",
  requiresScore: "number",
  locked: "boolean",
  collected: "boolean"
};
const SNAPSHOT_ENTITY_FIELDS = new Set(Object.keys(SNAPSHOT_ENTITY_FIELD_TYPES));

export function describeEngine() {
  return {
    name: "agentic-game-engine",
    coordinateSystem: "origin top-left, +x right, +y down, units tiles",
    fixedStepFps: 60,
    actions: [...ACTIONS],
    entityKinds: [...KINDS],
    scene: {
      checkCommand: "npm run check",
      checkFailureMode: "runs all requested scene files and exits non-zero if any fail",
      fields: [...SCENE_FIELDS],
      required: ["name", "tileSize", "world", "entities"],
      entityIdPattern: ID_PATTERN.source,
      worldFields: [...WORLD_FIELDS],
      worldRequired: ["width", "height"],
      entityFields: [...ENTITY_FIELDS],
      entityRequired: ["id", "kind", "x", "y", "w", "h"],
      entityRules: [
        "id must be a non-empty string",
        `id must use only ${ID_PATTERN_TEXT}`,
        "ids must be unique",
        "scene must have exactly one player and at least one goal",
        "x, y, w, and h must be numbers; w and h must be > 0",
        "entities must fit within world.width and world.height",
        "speed is only valid on player and must be > 0",
        "value is only valid on collectible and must be > 0",
        "requiresScore is only valid on goal and must be >= 0",
        "background and color, when present, must be strings",
        "player and goal entities must not overlap solids or hazards"
      ]
    },
    tests: {
      command: "npm test",
      failureMode: "runs all requested test files and exits non-zero if any fail",
      includes: ["tests/*.json fixtures", "tests/cli_simulate_default_steps.mjs", "tests/cli_run_server_surface.mjs"],
      fields: [...TEST_FIELDS],
      stepFields: [...STEP_FIELDS],
      expectFields: [...EXPECT_FIELDS],
      expectEntityIdPattern: ID_PATTERN.source,
      expectEntityFieldTypes: { ...SNAPSHOT_ENTITY_FIELD_TYPES },
      timing: {
        default: "omitted frames/seconds means one frame",
        frames: "positive integer",
        seconds: "finite number >= 0; 0 is a no-op; positive values step at least one frame"
      }
    },
    templates: {
      command: "npm run template -- <scene|test>",
      kinds: ["scene", "test"]
    },
    schemas: {
      command: "npm run schema",
      output: ["scene", "test"],
      draft: "https://json-schema.org/draft/2020-12/schema",
      sceneAnnotations: ["xXolotlValidation"],
      testAnnotations: ["xXolotlValidation"]
    },
    catalog: {
      command: "npm run catalog",
      output: ["scenes", "tests"],
      sceneOk: "valid and solvable",
      sceneValid: "passes scene validation before solving",
      fileErrors: "malformed or unreadable scene/test files appear as ok:false items instead of aborting the report"
    },
    verification: {
      command: "npm run verify",
      output: ["ok", "scenes", "tests"],
      fileErrors: "malformed or unreadable scene/test files appear as ok:false items instead of aborting the report"
    },
    simulation: {
      simulate: {
        command: "npm run simulate -- [scene] [steps-json|steps-file|right:4,down:4]",
        defaultScene: "scenes/level_01.json",
        stepSpecForms: ["steps array JSON", "object with steps", "steps JSON file", "shorthand"],
        defaultSceneStepSpecForms: ["steps array JSON", "object with steps", "shorthand"],
        stepFileRule: "pass a steps JSON file after an explicit scene path",
        shorthandExample: "right:4,down:4",
        shorthandActions: "combine simultaneous actions with +, e.g. right+down:4",
        waitActions: ["idle", "none", "wait"],
        output: ["scene", "ok", "error", "steps", "final"],
        fileErrors: "bad scene paths, malformed step specs, and runtime errors print ok:false JSON instead of aborting before output"
      },
      trace: {
        command: "npm run trace",
        output: ["test", "scene", "ok", "error", "steps", "final"],
        fileErrors: "malformed tests or unreadable referenced scenes appear as ok:false entries instead of aborting the report"
      },
      step: {
        state: "object returned by createState; status must be playing, won, or lost; playing states need valid scene, tileSize, tick, score, messages, integer world size, unique entity ids, exactly one player, at least one goal, and entities",
        dt: "finite number >= 0; 0 is a no-op",
        actions: "object with boolean left/right/up/down values; unknown actions throw"
      },
      actionsFromList: {
        input: "array of unique action strings",
        output: "boolean action map"
      },
      dumpState: {
        command: "npm run dump-state -- [scene]",
        defaultScene: "scenes/level_01.json",
        input: "state object returned by createState with scene, tileSize, integer world size, unique entity ids, exactly one player, and at least one goal",
        output: ["scene", "tick", "status", "score", "messages", "entities"]
      },
      runTest: {
        input: "scene plus test spec; optional onStep callback function",
        output: "final state"
      }
    },
    browser: {
      command: "npm run run -- [scene] [--port <port>]",
      defaultScene: "scenes/level_01.json",
      defaultPort: 5173,
      url: "http://127.0.0.1:<port>/?scene=/<scene>",
      controls: {
        move: ["WASD", "arrow keys"],
        reset: "Reset button",
        fullscreen: "f toggles fullscreen; Esc exits native fullscreen"
      },
      serves: ["web/*", "scenes/*", "src/*"],
      blockedPaths: ["package.json", ".git/*", "progress.md"],
      hooks: {
        render_game_to_text: {
          returns: ["coordinateSystem", "timeMode", "scene", "tick", "status", "score", "messages", "entities", "error"]
        },
        advanceTime: {
          arguments: ["ms", "actions"],
          ms: "finite number >= 0; 0 renders without stepping; positive values step at least one frame",
          actionShapes: ["booleanMap", "actionString", "actionArray", "testStepObject"],
          actionRule: "actions must match one actionShapes entry",
          actionArrayRule: "unique actions",
          booleanMapValues: "boolean",
          testStepObjectFields: ["action", "actions"],
          testStepObjectRule: "only action or actions; timing comes from ms argument",
          timeMode: "manual"
        },
        setManualTime: {
          arguments: ["enabled"],
          falseMode: "live"
        }
      }
    },
    solver: {
      command: "npm run solve",
      topLevel: "array",
      output: ["ok", "goal", "steps", "tick", "status", "final"],
      fileErrors: "malformed or unreadable scene files appear as ok:false results instead of aborting the solve run"
    }
  };
}

export function createTemplate(kind = "scene") {
  if (kind === "scene") {
    return {
      name: "Template Room",
      tileSize: 32,
      world: { width: 6, height: 4, background: "#121417" },
      entities: [
        { id: "player", kind: "player", x: 1, y: 1, w: 0.8, h: 0.8, speed: 4, color: "#78dce8" },
        { id: "exit", kind: "goal", x: 4, y: 1, w: 1, h: 1, color: "#a9dc76" },
        { id: "block", kind: "solid", x: 2, y: 2, w: 2, h: 1, color: "#fc9867" }
      ]
    };
  }
  if (kind === "test") {
    return {
      scene: "scenes/level_01.json",
      steps: [
        { actions: ["right"], frames: 240 },
        { actions: ["down"], frames: 120 }
      ],
      expect: {
        status: "won",
        messages: ["Reached exit"]
      }
    };
  }
  throw new Error("template kind must be scene or test");
}

export function describeSchemas() {
  const entityShape = {
    type: "object",
    required: ["id", "kind", "x", "y", "w", "h"],
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1, pattern: ID_PATTERN.source },
      kind: { enum: [...KINDS] },
      x: { type: "number" },
      y: { type: "number" },
      w: { type: "number", exclusiveMinimum: 0 },
      h: { type: "number", exclusiveMinimum: 0 },
      speed: { type: "number", exclusiveMinimum: 0 },
      value: { type: "number", exclusiveMinimum: 0 },
      requiresScore: { type: "number", minimum: 0 },
      color: { type: "string" }
    },
    allOf: [
      { if: { required: ["speed"] }, then: { properties: { kind: { const: "player" } } } },
      { if: { required: ["value"] }, then: { properties: { kind: { const: "collectible" } } } },
      { if: { required: ["requiresScore"] }, then: { properties: { kind: { const: "goal" } } } }
    ]
  };
  const sceneShape = {
    type: "object",
    required: ["name", "tileSize", "world", "entities"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1 },
      tileSize: { type: "integer", minimum: 1 },
      world: {
        type: "object",
        required: ["width", "height"],
        additionalProperties: false,
        properties: {
          width: { type: "integer", minimum: 1 },
          height: { type: "integer", minimum: 1 },
          background: { type: "string" }
        }
      },
      entities: {
        type: "array",
        items: entityShape,
        minItems: 1,
        allOf: [
          {
            contains: { type: "object", required: ["kind"], properties: { kind: { const: "player" } } },
            minContains: 1,
            maxContains: 1
          },
          {
            contains: { type: "object", required: ["kind"], properties: { kind: { const: "goal" } } },
            minContains: 1
          }
        ]
      }
    }
  };
  return {
    scene: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      xXolotlValidation: [
        "entity ids must be unique",
        "entities must fit within world.width and world.height",
        "player and goal entities must not overlap solids or hazards"
      ],
      ...sceneShape
    },
    test: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      xXolotlValidation: [
        "step without frames/seconds advances one frame",
        "seconds > 0 advances at least one 60 FPS frame",
        "expected validation/test error arrays assert required included errors"
      ],
      type: "object",
      required: ["scene"],
      additionalProperties: false,
      properties: {
        scene: { oneOf: [{ type: "string" }, sceneShape] },
        steps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            allOf: [
              { not: { required: ["action", "actions"] } },
              { not: { required: ["frames", "seconds"] } }
            ],
            properties: {
              action: { enum: [...ACTIONS] },
              actions: { type: "array", uniqueItems: true, items: { enum: [...ACTIONS] } },
              seconds: { type: "number", minimum: 0 },
              frames: { type: "integer", minimum: 1 }
            }
          }
        },
        expect: {
          type: "object",
          additionalProperties: false,
          allOf: [
            { not: { required: ["validationErrors", "testErrors"] } }
          ],
          properties: {
            status: { enum: [...STATUSES] },
            tick: { type: "integer", minimum: 0 },
            score: { type: "number" },
            messages: { type: "array", items: { type: "string" } },
            entities: {
              type: "object",
              propertyNames: { pattern: ID_PATTERN.source },
              additionalProperties: {
                type: "object",
                additionalProperties: false,
                properties: Object.fromEntries(Object.entries(SNAPSHOT_ENTITY_FIELD_TYPES).map(([field, type]) => [field, { type }]))
              }
            },
            tolerance: { type: "number", minimum: 0 },
            validationErrors: { type: "array", minItems: 1, items: { type: "string" } },
            testErrors: { type: "array", minItems: 1, items: { type: "string" } }
          },
          additionalProperties: false
        }
      }
    }
  };
}

export function validateScene(scene) {
  const errors = [];
  const isNum = (v) => Number.isFinite(v);
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const sceneObject = isObj(scene) ? scene : {};

  if (!isObj(scene)) errors.push("scene must be an object");
  for (const field of Object.keys(sceneObject)) {
    if (!SCENE_FIELDS.has(field)) errors.push(`scene.${field} is unknown`);
  }
  if (typeof scene?.name !== "string" || !scene.name) errors.push("scene.name must be a non-empty string");
  if (!Number.isInteger(scene?.tileSize) || scene.tileSize < 1) errors.push("scene.tileSize must be a positive integer");
  if (!isObj(scene?.world)) errors.push("scene.world must be an object");
  const world = isObj(scene?.world) ? scene.world : {};
  for (const field of Object.keys(world)) {
    if (!WORLD_FIELDS.has(field)) errors.push(`scene.world.${field} is unknown`);
  }
  if (!Number.isInteger(scene?.world?.width) || scene.world.width < 1) errors.push("scene.world.width must be a positive integer");
  if (!Number.isInteger(scene?.world?.height) || scene.world.height < 1) errors.push("scene.world.height must be a positive integer");
  if (scene?.world?.background !== undefined && typeof scene.world.background !== "string") errors.push("scene.world.background must be a string");
  if (!Array.isArray(scene?.entities)) errors.push("scene.entities must be an array");

  const ids = new Set();
  let players = 0;
  let goals = 0;
  const validEntities = [];
  const entities = Array.isArray(scene?.entities) ? scene.entities : [];
  for (const [index, entity] of entities.entries()) {
    const where = `entities[${index}]`;
    if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    for (const field of Object.keys(entity)) {
      if (!ENTITY_FIELDS.has(field)) errors.push(`${where}.${field} is unknown`);
    }
    if (typeof entity?.id !== "string" || !entity.id) errors.push(`${where}.id must be a non-empty string`);
    else {
      if (!ID_PATTERN.test(entity.id)) errors.push(`${where}.id must use only ${ID_PATTERN_TEXT}`);
      if (ids.has(entity.id)) errors.push(`${where}.id duplicates ${entity.id}`);
      ids.add(entity.id);
    }
    if (!KINDS.has(entity?.kind)) errors.push(`${where}.kind must be one of ${[...KINDS].join(", ")}`);
    if (entity?.kind === "player") players += 1;
    if (entity?.kind === "goal") goals += 1;
    for (const field of ["x", "y", "w", "h"]) {
      if (!isNum(entity?.[field])) errors.push(`${where}.${field} must be a number`);
    }
    if (isNum(entity?.w) && entity.w <= 0) errors.push(`${where}.w must be > 0`);
    if (isNum(entity?.h) && entity.h <= 0) errors.push(`${where}.h must be > 0`);
    if (entity?.speed !== undefined && (!isNum(entity.speed) || entity.speed <= 0)) errors.push(`${where}.speed must be > 0`);
    if (entity?.speed !== undefined && entity.kind !== "player") errors.push(`${where}.speed is only valid on player`);
    if (entity?.value !== undefined && (!isNum(entity.value) || entity.value <= 0)) errors.push(`${where}.value must be > 0`);
    if (entity?.value !== undefined && entity.kind !== "collectible") errors.push(`${where}.value is only valid on collectible`);
    if (entity?.requiresScore !== undefined && (!isNum(entity.requiresScore) || entity.requiresScore < 0)) {
      errors.push(`${where}.requiresScore must be >= 0`);
    }
    if (entity?.requiresScore !== undefined && entity.kind !== "goal") errors.push(`${where}.requiresScore is only valid on goal`);
    if (entity?.color !== undefined && typeof entity.color !== "string") errors.push(`${where}.color must be a string`);
    if (["x", "y", "w", "h"].every((field) => isNum(entity?.[field]))) {
      if (entity.x < 0) errors.push(`${where}.x must be >= 0`);
      if (entity.y < 0) errors.push(`${where}.y must be >= 0`);
      if (isNum(scene?.world?.width) && entity.x + entity.w > scene.world.width) errors.push(`${where} must fit within world.width`);
      if (isNum(scene?.world?.height) && entity.y + entity.h > scene.world.height) errors.push(`${where} must fit within world.height`);
      validEntities.push({ index, entity });
    }
  }
  for (const { index, entity } of validEntities.filter((item) => ["player", "goal"].includes(item.entity.kind))) {
    for (const blocker of validEntities.filter((item) => ["solid", "hazard"].includes(item.entity.kind))) {
      if (overlaps(entity, blocker.entity)) errors.push(`entities[${index}] overlaps ${blocker.entity.kind} ${blocker.entity.id}`);
    }
  }
  if (players !== 1) errors.push("scene must have exactly one player");
  if (goals < 1) errors.push("scene must have at least one goal");
  return errors;
}

export function createState(scene) {
  const errors = validateScene(scene);
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    tick: 0,
    status: "playing",
    scene: scene.name,
    world: { ...scene.world },
    tileSize: scene.tileSize,
    score: 0,
    entities: scene.entities.map((entity) => ({ ...entity })),
    messages: []
  };
}

export function step(state, actions = {}, dt = 1 / 60) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("step state must be an object");
  if (!STATUSES.has(state.status)) throw new Error(`step state.status must be one of ${[...STATUSES].join(", ")}`);
  if (!Number.isFinite(dt) || dt < 0) throw new Error("step dt must be >= 0");
  if (!actions || typeof actions !== "object" || Array.isArray(actions)) throw new Error("step actions must be an object");
  for (const [action, pressed] of Object.entries(actions)) {
    if (!ACTIONS.has(action)) throw new Error(`unknown action: ${action}`);
    if (typeof pressed !== "boolean") throw new Error(`action ${action} must be boolean`);
  }
  if (state.status !== "playing") return state;
  assertRuntimeRoot(state, "step state");
  if (!Number.isInteger(state.tick) || state.tick < 0) throw new Error("step state.tick must be a non-negative integer");
  if (!Number.isFinite(state.score)) throw new Error("step state.score must be a number");
  assertRuntimeMessages(state, "step state");
  if (!Array.isArray(state.entities)) throw new Error("step state.entities must be an array");
  const world = assertRuntimeWorld(state, "step state");
  state.entities.forEach((entity, index) => assertRuntimeEntity(entity, index, "step state", world));
  assertRuntimeEntityIds(state.entities, "step state");
  assertRuntimeEntityCounts(state.entities, "step state");
  const player = state.entities.find((entity) => entity.kind === "player");
  if (dt === 0) return state;
  const speed = player.speed ?? 4;
  const dx = (actions.right ? 1 : 0) - (actions.left ? 1 : 0);
  const dy = (actions.down ? 1 : 0) - (actions.up ? 1 : 0);
  const scale = dx && dy ? Math.SQRT1_2 : 1;

  moveAxis(state, player, "x", dx * speed * scale * dt);
  moveAxis(state, player, "y", dy * speed * scale * dt);
  state.tick += 1;

  const hazard = state.entities.find((entity) => entity.kind === "hazard" && overlaps(player, entity));
  if (hazard) {
    state.status = "lost";
    state.messages.push(`Hit ${hazard.id}`);
    return state;
  }

  for (const item of state.entities.filter((entity) => entity.kind === "collectible" && !entity.collected && overlaps(player, entity))) {
    item.collected = true;
    state.score += item.value ?? 1;
    state.messages.push(`Collected ${item.id}`);
  }

  const goal = state.entities.find((entity) => entity.kind === "goal" && overlaps(player, entity));
  if (goal) {
    const required = goal.requiresScore ?? 0;
    if (state.score >= required) {
      state.status = "won";
      state.messages.push(`Reached ${goal.id}`);
    } else {
      const message = `Need score ${required} for ${goal.id}`;
      if (!state.messages.includes(message)) state.messages.push(message);
    }
  }
  return state;
}

function assertRuntimeWorld(state, owner) {
  if (!state.world || typeof state.world !== "object" || !Number.isInteger(state.world.width) || !Number.isInteger(state.world.height) || state.world.width < 1 || state.world.height < 1) {
    throw new Error(`${owner}.world must have positive integer width and height`);
  }
  for (const field of Object.keys(state.world)) {
    if (!WORLD_FIELDS.has(field)) throw new Error(`${owner}.world.${field} is unknown`);
  }
  if (state.world.background !== undefined && typeof state.world.background !== "string") throw new Error(`${owner}.world.background must be a string`);
  return state.world;
}

function assertRuntimeMessages(state, owner) {
  if (!Array.isArray(state.messages)) throw new Error(`${owner}.messages must be an array`);
  for (const [index, message] of state.messages.entries()) {
    if (typeof message !== "string") throw new Error(`${owner}.messages[${index}] must be a string`);
  }
}

function assertRuntimeRoot(state, owner) {
  if (typeof state.scene !== "string" || !state.scene) throw new Error(`${owner}.scene must be a non-empty string`);
  if (!Number.isInteger(state.tileSize) || state.tileSize < 1) throw new Error(`${owner}.tileSize must be a positive integer`);
}

function assertRuntimeEntity(entity, index, owner = "step state", world) {
  const where = `${owner}.entities[${index}]`;
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) throw new Error(`${where} must be an object`);
  for (const field of Object.keys(entity)) {
    if (!RUNTIME_ENTITY_FIELDS.has(field)) throw new Error(`${where}.${field} is unknown`);
  }
  if (typeof entity.id !== "string" || !entity.id) throw new Error(`${where}.id must be a non-empty string`);
  if (!ID_PATTERN.test(entity.id)) throw new Error(`${where}.id must use only ${ID_PATTERN_TEXT}`);
  if (!KINDS.has(entity.kind)) throw new Error(`${where}.kind must be one of ${[...KINDS].join(", ")}`);
  for (const field of ["x", "y", "w", "h"]) {
    if (!Number.isFinite(entity[field])) throw new Error(`${where}.${field} must be a number`);
  }
  if (entity.w <= 0) throw new Error(`${where}.w must be > 0`);
  if (entity.h <= 0) throw new Error(`${where}.h must be > 0`);
  if (world) {
    if (entity.x < 0) throw new Error(`${where}.x must be >= 0`);
    if (entity.y < 0) throw new Error(`${where}.y must be >= 0`);
    if (entity.x + entity.w > world.width) throw new Error(`${where} must fit within world.width`);
    if (entity.y + entity.h > world.height) throw new Error(`${where} must fit within world.height`);
  }
  if (entity.speed !== undefined && (!Number.isFinite(entity.speed) || entity.speed <= 0)) throw new Error(`${where}.speed must be > 0`);
  if (entity.speed !== undefined && entity.kind !== "player") throw new Error(`${where}.speed is only valid on player`);
  if (entity.value !== undefined && (!Number.isFinite(entity.value) || entity.value <= 0)) throw new Error(`${where}.value must be > 0`);
  if (entity.value !== undefined && entity.kind !== "collectible") throw new Error(`${where}.value is only valid on collectible`);
  if (entity.requiresScore !== undefined && (!Number.isFinite(entity.requiresScore) || entity.requiresScore < 0)) throw new Error(`${where}.requiresScore must be >= 0`);
  if (entity.requiresScore !== undefined && entity.kind !== "goal") throw new Error(`${where}.requiresScore is only valid on goal`);
  if (entity.color !== undefined && typeof entity.color !== "string") throw new Error(`${where}.color must be a string`);
  if (entity.collected !== undefined && typeof entity.collected !== "boolean") throw new Error(`${where}.collected must be boolean`);
  if (entity.collected !== undefined && entity.kind !== "collectible") throw new Error(`${where}.collected is only valid on collectible`);
}

function assertRuntimeEntityIds(entities, owner) {
  const ids = new Set();
  for (const [index, entity] of entities.entries()) {
    if (ids.has(entity.id)) throw new Error(`${owner}.entities[${index}].id duplicates ${entity.id}`);
    ids.add(entity.id);
  }
}

function assertRuntimeEntityCounts(entities, owner) {
  const players = entities.filter((entity) => entity.kind === "player").length;
  const goals = entities.filter((entity) => entity.kind === "goal").length;
  if (players !== 1) throw new Error(`${owner} must have exactly one player`);
  if (goals < 1) throw new Error(`${owner} must have at least one goal`);
}

export function actionsFromList(list = []) {
  if (!Array.isArray(list)) throw new Error("actions list must be an array");
  const actions = {};
  for (const action of list) {
    if (!ACTIONS.has(action)) throw new Error(`unknown action: ${action}`);
    if (actions[action]) throw new Error(`duplicate action: ${action}`);
    actions[action] = true;
  }
  return actions;
}

export function runTest(scene, test, onStep) {
  if (onStep !== undefined && typeof onStep !== "function") throw new Error("runTest onStep must be a function");
  const testErrors = validateTest(test, { requireScene: false });
  if (testErrors.length) throw new Error(testErrors.join("\n"));
  const state = createState(scene);
  for (const [index, item] of (test.steps ?? []).entries()) {
    const actions = actionsFromList(item.actions ?? [item.action].filter(Boolean));
    const frames = framesForStep(item);
    for (let i = 0; i < frames; i += 1) step(state, actions, 1 / 60);
    onStep?.({
      step: index,
      actions: Object.keys(actions).filter((action) => actions[action]),
      seconds: item.seconds ?? frames / 60,
      frames,
      state: dumpState(state)
    });
  }
  assertExpected(state, test.expect ?? {});
  return state;
}

export function validateTest(test, { requireScene = true } = {}) {
  const errors = [];
  if (!test || typeof test !== "object" || Array.isArray(test)) return ["test must be an object"];
  const allowedActions = [...ACTIONS].join(", ");
  const allowedStatuses = [...STATUSES].join(", ");
  for (const field of Object.keys(test)) {
    if (!TEST_FIELDS.has(field)) errors.push(`test.${field} is unknown`);
  }
  if (requireScene && test.scene === undefined) errors.push("scene is required");
  else if (test.scene !== undefined && typeof test.scene !== "string" && (!test.scene || typeof test.scene !== "object" || Array.isArray(test.scene))) {
    errors.push("scene must be a string path or inline scene object");
  }
  if (test.steps !== undefined && !Array.isArray(test.steps)) errors.push("steps must be an array");
  for (const [index, step] of (Array.isArray(test?.steps) ? test.steps : []).entries()) {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      errors.push(`steps[${index}] must be an object`);
      continue;
    }
    for (const field of Object.keys(step)) {
      if (!STEP_FIELDS.has(field)) errors.push(`steps[${index}].${field} is unknown`);
    }
    if (step.action !== undefined && !ACTIONS.has(step.action)) errors.push(`steps[${index}].action must be one of ${allowedActions}`);
    if (step.actions !== undefined && !Array.isArray(step.actions)) errors.push(`steps[${index}].actions must be an array`);
    const seenActions = new Set();
    for (const [actionIndex, action] of (Array.isArray(step.actions) ? step.actions : []).entries()) {
      if (!ACTIONS.has(action)) errors.push(`steps[${index}].actions[${actionIndex}] must be one of ${allowedActions}`);
      else if (seenActions.has(action)) errors.push(`steps[${index}].actions[${actionIndex}] duplicates ${action}`);
      seenActions.add(action);
    }
    if (step.action !== undefined && step.actions !== undefined) errors.push(`steps[${index}] cannot use both action and actions`);
    if (step.frames !== undefined && (!Number.isInteger(step.frames) || step.frames < 1)) errors.push(`steps[${index}].frames must be a positive integer`);
    if (step.seconds !== undefined && (!Number.isFinite(step.seconds) || step.seconds < 0)) errors.push(`steps[${index}].seconds must be >= 0`);
    if (step.frames !== undefined && step.seconds !== undefined) errors.push(`steps[${index}] cannot use both frames and seconds`);
  }
  if (test?.expect !== undefined && (!test.expect || typeof test.expect !== "object" || Array.isArray(test.expect))) errors.push("expect must be an object");
  const expect = test?.expect && typeof test.expect === "object" && !Array.isArray(test.expect) ? test.expect : {};
  for (const field of Object.keys(expect)) {
    if (!EXPECT_FIELDS.has(field)) errors.push(`expect.${field} is unknown`);
  }
  if (expect.status !== undefined && !STATUSES.has(expect.status)) errors.push(`expect.status must be one of ${allowedStatuses}`);
  if (expect.tick !== undefined && (!Number.isInteger(expect.tick) || expect.tick < 0)) errors.push("expect.tick must be a non-negative integer");
  if (expect.score !== undefined && !Number.isFinite(expect.score)) errors.push("expect.score must be a number");
  if (expect.tolerance !== undefined && (!Number.isFinite(expect.tolerance) || expect.tolerance < 0)) errors.push("expect.tolerance must be >= 0");
  validateStringArray(errors, "expect.messages", expect.messages);
  validateStringArray(errors, "expect.validationErrors", expect.validationErrors, { nonEmpty: true });
  validateStringArray(errors, "expect.testErrors", expect.testErrors, { nonEmpty: true });
  if (expect.validationErrors !== undefined && expect.testErrors !== undefined) errors.push("expect cannot use both validationErrors and testErrors");
  if (expect.entities !== undefined && (!expect.entities || typeof expect.entities !== "object" || Array.isArray(expect.entities))) errors.push("expect.entities must be an object");
  for (const [id, fields] of Object.entries(expect.entities && typeof expect.entities === "object" && !Array.isArray(expect.entities) ? expect.entities : {})) {
    const where = ID_PATTERN.test(id) ? `expect.entities.${id}` : `expect.entities[${JSON.stringify(id)}]`;
    if (!ID_PATTERN.test(id)) errors.push(`${where} must use only ${ID_PATTERN_TEXT}`);
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      errors.push(`${where} must be an object`);
      continue;
    }
    for (const field of Object.keys(fields)) {
      if (!SNAPSHOT_ENTITY_FIELDS.has(field)) errors.push(`${where}.${field} is unknown`);
      else validateExpectedType(errors, `${where}.${field}`, fields[field], SNAPSHOT_ENTITY_FIELD_TYPES[field]);
    }
  }
  return errors;
}

function validateExpectedType(errors, name, value, type) {
  if (type === "number" && !Number.isFinite(value)) errors.push(`${name} must be a number`);
  else if (type !== "number" && typeof value !== type) errors.push(`${name} must be a ${type}`);
}

function validateStringArray(errors, name, value, { nonEmpty = false } = {}) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${name} must be an array`);
    return;
  }
  if (nonEmpty && value.length === 0) errors.push(`${name} must contain at least one string`);
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") errors.push(`${name}[${index}] must be a string`);
  }
}

export function solveScene(scene) {
  const state = createState(scene);
  const player = state.entities.find((entity) => entity.kind === "player");
  const failures = [];
  for (const goal of state.entities.filter((entity) => entity.kind === "goal")) {
    const result = solveGoal(scene, state, player, goal);
    if (result.ok) return result;
    failures.push(`${goal.id}: ${result.error}`);
  }
  return { ok: false, error: failures.join("; ") };
}

function solveGoal(scene, state, player, goal) {
  let start = { x: Math.round(player.x), y: Math.round(player.y) };
  const path = [];
  let plannedScore = 0;
  const collectibles = state.entities.filter((entity) => entity.kind === "collectible").sort((a, b) => a.id.localeCompare(b.id));
  while (plannedScore < (goal.requiresScore ?? 0)) {
    if (!collectibles.length) return { ok: false, error: `not enough collectible value for ${goal.id}` };
    let segment;
    const index = collectibles.findIndex((item) => {
      segment = findGridPath(state, player, item, start);
      return segment;
    });
    if (index < 0) return { ok: false, error: `no reachable collectible for ${goal.id}` };
    const [next] = collectibles.splice(index, 1);
    path.push(...segment);
    plannedScore += next.value ?? 1;
    start = segment.at(-1)?.point ?? start;
  }
  const goalPath = findGridPath(state, player, goal, start);
  if (!goalPath) return { ok: false, error: "no grid path to goal" };
  path.push(...goalPath);
  const framesPerTile = Math.max(1, Math.round(60 / (player.speed ?? 4)));
  const steps = pathToSteps(path, framesPerTile);
  try {
    const finalState = runTest(scene, { steps, expect: { status: "won", messages: [`Reached ${goal.id}`] } });
    return { ok: true, goal: goal.id, steps, tick: finalState.tick, status: finalState.status, final: dumpState(finalState) };
  } catch (error) {
    return { ok: false, error: error.message, steps };
  }
}

export function dumpState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("dumpState state must be an object");
  assertRuntimeRoot(state, "dumpState state");
  if (!Number.isInteger(state.tick) || state.tick < 0) throw new Error("dumpState state.tick must be a non-negative integer");
  if (!STATUSES.has(state.status)) throw new Error(`dumpState state.status must be one of ${[...STATUSES].join(", ")}`);
  if (!Number.isFinite(state.score)) throw new Error("dumpState state.score must be a number");
  assertRuntimeMessages(state, "dumpState state");
  if (!Array.isArray(state.entities)) throw new Error("dumpState state.entities must be an array");
  const world = assertRuntimeWorld(state, "dumpState state");
  state.entities.forEach((entity, index) => assertRuntimeEntity(entity, index, "dumpState state", world));
  assertRuntimeEntityIds(state.entities, "dumpState state");
  assertRuntimeEntityCounts(state.entities, "dumpState state");
  return {
    scene: state.scene,
    tick: state.tick,
    status: state.status,
    score: state.score,
    messages: [...state.messages],
    entities: state.entities.map((entity) => {
      const { id, kind, x, y, w, h, value, requiresScore, collected } = entity;
      return {
        id,
        kind,
        x,
        y,
        w,
        h,
        ...(value !== undefined ? { value } : {}),
        ...(requiresScore !== undefined ? { requiresScore, locked: state.score < requiresScore } : {}),
        ...(collected !== undefined ? { collected } : {})
      };
    })
  };
}

function findGridPath(state, player, goal, start) {
  // ponytail: grid solver matches current tile-based scenes; upgrade to engine-step search when sub-tile mechanics matter.
  const queue = [start];
  const seen = new Set([pointKey(start)]);
  const parents = new Map();
  const moves = [
    ["right", 1, 0],
    ["down", 0, 1],
    ["left", -1, 0],
    ["up", 0, -1]
  ];

  for (let head = 0; head < queue.length; head += 1) {
    const point = queue[head];
    if (overlaps({ ...player, x: point.x, y: point.y }, goal)) return buildPath(point, parents);
    for (const [action, dx, dy] of moves) {
      const next = { x: point.x + dx, y: point.y + dy };
      const key = pointKey(next);
      if (seen.has(key) || !canStand(state, player, next.x, next.y)) continue;
      seen.add(key);
      parents.set(key, { point, action });
      queue.push(next);
    }
  }
  return null;
}

function canStand(state, player, x, y) {
  const body = { ...player, x, y };
  if (x < 0 || y < 0 || x + player.w > state.world.width || y + player.h > state.world.height) return false;
  return state.entities.every((entity) => !["solid", "hazard"].includes(entity.kind) || !overlaps(body, entity));
}

function buildPath(end, parents) {
  const path = [];
  for (let current = end; parents.has(pointKey(current)); ) {
    const parent = parents.get(pointKey(current));
    path.push({ action: parent.action, point: current });
    current = parent.point;
  }
  return path.reverse();
}

function pathToSteps(path, framesPerTile) {
  const steps = [];
  for (const item of path) {
    const previous = steps.at(-1);
    if (previous?.actions[0] === item.action) previous.frames += framesPerTile;
    else steps.push({ actions: [item.action], frames: framesPerTile });
  }
  return steps;
}

function pointKey({ x, y }) {
  return `${x},${y}`;
}

function moveAxis(state, player, axis, delta) {
  if (!delta) return;
  player[axis] += delta;
  player.x = clamp(player.x, 0, state.world.width - player.w);
  player.y = clamp(player.y, 0, state.world.height - player.h);

  for (const solid of state.entities.filter((entity) => entity.kind === "solid")) {
    if (!overlaps(player, solid)) continue;
    if (axis === "x") player.x = delta > 0 ? solid.x - player.w : solid.x + solid.w;
    else player.y = delta > 0 ? solid.y - player.h : solid.y + solid.h;
  }
}

function assertExpected(state, expected) {
  const actual = dumpState(state);
  if (expected.status && actual.status !== expected.status) {
    throw new Error(`expected status ${expected.status}, got ${actual.status}`);
  }
  if (expected.tick !== undefined && actual.tick !== expected.tick) {
    throw new Error(`expected tick ${expected.tick}, got ${actual.tick}`);
  }
  if (expected.score !== undefined && actual.score !== expected.score) {
    throw new Error(`expected score ${expected.score}, got ${actual.score}`);
  }
  for (const message of expected.messages ?? []) {
    if (!actual.messages.includes(message)) throw new Error(`expected message: ${message}`);
  }
  for (const [id, fields] of Object.entries(expected.entities ?? {})) {
    const entity = actual.entities.find((item) => item.id === id);
    if (!entity) throw new Error(`expected entity ${id}`);
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value === "number" && (!Number.isFinite(entity[field]) || Math.abs(entity[field] - value) > (expected.tolerance ?? 1e-9))) {
        throw new Error(`expected ${id}.${field} ${value}, got ${entity[field]}`);
      }
      if (typeof value !== "number" && entity[field] !== value) {
        throw new Error(`expected ${id}.${field} ${value}, got ${entity[field]}`);
      }
    }
  }
}

function framesForStep(item) {
  if (item.frames !== undefined) {
    if (!Number.isInteger(item.frames) || item.frames < 1) throw new Error("step.frames must be a positive integer");
    return item.frames;
  }
  if (item.seconds !== undefined) {
    if (!Number.isFinite(item.seconds) || item.seconds < 0) throw new Error("step.seconds must be >= 0");
    return item.seconds === 0 ? 0 : Math.max(1, Math.round(item.seconds * 60));
  }
  return 1;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
