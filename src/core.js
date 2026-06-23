const KINDS = new Set(["player", "solid", "hazard", "goal", "collectible", "decor"]);
const ACTIONS = new Set(["left", "right", "up", "down"]);

export function describeEngine() {
  return {
    name: "agentic-game-engine",
    coordinateSystem: "origin top-left, +x right, +y down, units tiles",
    fixedStepFps: 60,
    actions: [...ACTIONS],
    entityKinds: [...KINDS],
    scene: {
      required: ["name", "tileSize", "world", "entities"],
      worldRequired: ["width", "height"],
      entityRequired: ["id", "kind", "x", "y", "w", "h"],
      entityRules: [
        "speed, when present, must be > 0",
        "value, when present, must be > 0",
        "requiresScore, when present, must be >= 0",
        "player and goal entities must not overlap solids"
      ]
    },
    tests: {
      stepFields: ["action", "actions", "seconds", "frames"],
      expectFields: ["status", "tick", "score", "messages", "entities", "tolerance", "validationErrors"]
    },
    templates: {
      command: "npm run template",
      kinds: ["scene", "test"]
    },
    catalog: {
      command: "npm run catalog",
      output: ["scenes", "tests"]
    },
    solver: {
      command: "npm run solve",
      output: ["ok", "steps", "tick", "status", "final"]
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
    additionalProperties: true,
    properties: {
      id: { type: "string", minLength: 1 },
      kind: { enum: [...KINDS] },
      x: { type: "number" },
      y: { type: "number" },
      w: { type: "number", exclusiveMinimum: 0 },
      h: { type: "number", exclusiveMinimum: 0 },
      speed: { type: "number", exclusiveMinimum: 0 },
      value: { type: "number", exclusiveMinimum: 0 },
      requiresScore: { type: "number", minimum: 0 },
      color: { type: "string" }
    }
  };
  const sceneShape = {
    type: "object",
    required: ["name", "tileSize", "world", "entities"],
    additionalProperties: true,
    properties: {
      name: { type: "string", minLength: 1 },
      tileSize: { type: "number", exclusiveMinimum: 0 },
      world: {
        type: "object",
        required: ["width", "height"],
        additionalProperties: true,
        properties: {
          width: { type: "number", exclusiveMinimum: 0 },
          height: { type: "number", exclusiveMinimum: 0 },
          background: { type: "string" }
        }
      },
      entities: { type: "array", items: entityShape, minItems: 1 }
    }
  };
  return {
    scene: { $schema: "https://json-schema.org/draft/2020-12/schema", ...sceneShape },
    test: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      required: ["scene"],
      additionalProperties: true,
      properties: {
        scene: { oneOf: [{ type: "string" }, sceneShape] },
        steps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
            properties: {
              action: { enum: [...ACTIONS] },
              actions: { type: "array", items: { enum: [...ACTIONS] } },
              seconds: { type: "number", minimum: 0 },
              frames: { type: "integer", minimum: 1 }
            }
          }
        },
        expect: {
          type: "object",
          additionalProperties: true,
          properties: {
            status: { enum: ["playing", "won", "lost"] },
            tick: { type: "integer", minimum: 0 },
            score: { type: "number" },
            messages: { type: "array", items: { type: "string" } },
            entities: { type: "object", additionalProperties: { type: "object" } },
            tolerance: { type: "number", minimum: 0 },
            validationErrors: { type: "array", items: { type: "string" } }
          }
        }
      }
    }
  };
}

export function validateScene(scene) {
  const errors = [];
  const isNum = (v) => Number.isFinite(v);

  if (!scene || typeof scene !== "object") errors.push("scene must be an object");
  if (!scene?.name) errors.push("scene.name is required");
  if (!isNum(scene?.tileSize) || scene.tileSize <= 0) errors.push("scene.tileSize must be > 0");
  if (!isNum(scene?.world?.width) || scene.world.width <= 0) errors.push("scene.world.width must be > 0");
  if (!isNum(scene?.world?.height) || scene.world.height <= 0) errors.push("scene.world.height must be > 0");
  if (!Array.isArray(scene?.entities)) errors.push("scene.entities must be an array");

  const ids = new Set();
  let players = 0;
  let goals = 0;
  const validEntities = [];
  for (const [index, entity] of (scene?.entities ?? []).entries()) {
    const where = `entities[${index}]`;
    if (!entity?.id) errors.push(`${where}.id is required`);
    if (entity?.id && ids.has(entity.id)) errors.push(`${where}.id duplicates ${entity.id}`);
    ids.add(entity?.id);
    if (!KINDS.has(entity?.kind)) errors.push(`${where}.kind must be one of ${[...KINDS].join(", ")}`);
    if (entity?.kind === "player") players += 1;
    if (entity?.kind === "goal") goals += 1;
    for (const field of ["x", "y", "w", "h"]) {
      if (!isNum(entity?.[field])) errors.push(`${where}.${field} must be a number`);
    }
    if (isNum(entity?.w) && entity.w <= 0) errors.push(`${where}.w must be > 0`);
    if (isNum(entity?.h) && entity.h <= 0) errors.push(`${where}.h must be > 0`);
    if (entity?.speed !== undefined && (!isNum(entity.speed) || entity.speed <= 0)) errors.push(`${where}.speed must be > 0`);
    if (entity?.value !== undefined && (!isNum(entity.value) || entity.value <= 0)) errors.push(`${where}.value must be > 0`);
    if (entity?.requiresScore !== undefined && (!isNum(entity.requiresScore) || entity.requiresScore < 0)) {
      errors.push(`${where}.requiresScore must be >= 0`);
    }
    if (["x", "y", "w", "h"].every((field) => isNum(entity?.[field]))) {
      if (entity.x < 0) errors.push(`${where}.x must be >= 0`);
      if (entity.y < 0) errors.push(`${where}.y must be >= 0`);
      if (isNum(scene?.world?.width) && entity.x + entity.w > scene.world.width) errors.push(`${where} must fit within world.width`);
      if (isNum(scene?.world?.height) && entity.y + entity.h > scene.world.height) errors.push(`${where} must fit within world.height`);
      validEntities.push({ index, entity });
    }
  }
  for (const { index, entity } of validEntities.filter((item) => ["player", "goal"].includes(item.entity.kind))) {
    for (const solid of validEntities.filter((item) => item.entity.kind === "solid")) {
      if (overlaps(entity, solid.entity)) errors.push(`entities[${index}] overlaps solid ${solid.entity.id}`);
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
  if (state.status !== "playing") return state;
  const player = state.entities.find((entity) => entity.kind === "player");
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

export function actionsFromList(list = []) {
  const actions = {};
  for (const action of list) {
    if (!ACTIONS.has(action)) throw new Error(`unknown action: ${action}`);
    actions[action] = true;
  }
  return actions;
}

export function runTest(scene, test, onStep) {
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

export function solveScene(scene) {
  const state = createState(scene);
  const player = state.entities.find((entity) => entity.kind === "player");
  const goal = state.entities.find((entity) => entity.kind === "goal");
  let start = { x: Math.round(player.x), y: Math.round(player.y) };
  const path = [];
  let plannedScore = 0;
  const collectibles = state.entities.filter((entity) => entity.kind === "collectible").sort((a, b) => a.id.localeCompare(b.id));
  while (plannedScore < (goal.requiresScore ?? 0)) {
    const next = collectibles.shift();
    if (!next) return { ok: false, error: `not enough collectible value for ${goal.id}` };
    const segment = findGridPath(state, player, next, start);
    if (!segment) return { ok: false, error: `no grid path to ${next.id}` };
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
    const finalState = runTest(scene, { steps, expect: { status: "won" } });
    return { ok: true, steps, tick: finalState.tick, status: finalState.status, final: dumpState(finalState) };
  } catch (error) {
    return { ok: false, error: error.message, steps };
  }
}

export function dumpState(state) {
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
  if (!Number.isFinite(item.seconds ?? 0) || (item.seconds ?? 0) < 0) throw new Error("step.seconds must be >= 0");
  return Math.max(1, Math.round((item.seconds ?? 0) * 60));
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
