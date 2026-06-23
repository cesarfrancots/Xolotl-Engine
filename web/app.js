import { actionsFromList, createState, dumpState, step } from "/src/core.js";

const canvas = document.querySelector("#game");
const shell = document.querySelector("main");
const ctx = canvas.getContext("2d");
const statusEl = document.querySelector("#status");
const sceneEl = document.querySelector("#scene");
const scoreEl = document.querySelector("#score");
const reset = document.querySelector("#reset");
const keys = new Set();
const ACTION_OBJECT_FIELDS = new Set(["action", "actions"]);

const sceneUrl = new URLSearchParams(location.search).get("scene") ?? "/scenes/level_01.json";
let scene = null;
let state = null;
let loadError = "";
let last = performance.now();
let manualTime = false;

reset.addEventListener("click", () => {
  if (loadError) {
    void loadScene();
    return;
  }
  state = createState(scene);
  manualTime = false;
  render();
});
addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    void toggleFullscreen();
    return;
  }
  if (isMoveKey(event.key)) event.preventDefault();
  if (isMoveKey(event.key)) manualTime = false;
  keys.add(event.key.toLowerCase());
});
addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});
document.addEventListener("fullscreenchange", render);

window.render_game_to_text = renderGameToText;
window.setManualTime = (enabled = true) => {
  manualTime = enabled;
  last = performance.now();
  render();
  return renderGameToText();
};
window.advanceTime = (ms = 1000 / 60, actions = input()) => {
  if (!Number.isFinite(ms) || ms < 0) throw new Error("advanceTime ms must be >= 0");
  manualTime = true;
  if (!state) {
    render();
    return renderGameToText();
  }
  const frames = ms === 0 ? 0 : Math.max(1, Math.round(ms / (1000 / 60)));
  const normalizedActions = normalizeActions(actions);
  for (let i = 0; i < frames; i += 1) step(state, normalizedActions, 1 / 60);
  last = performance.now();
  render();
  return renderGameToText();
};
window.toggleFullscreen = toggleFullscreen;

await loadScene();
requestAnimationFrame(loop);

async function loadScene() {
  manualTime = false;
  loadError = "";
  try {
    const response = await fetch(sceneUrl);
    if (!response.ok) throw new Error(`failed to load ${sceneUrl}: ${response.status}`);
    scene = await response.json();
    state = createState(scene);
    canvas.width = scene.world.width * scene.tileSize;
    canvas.height = scene.world.height * scene.tileSize;
    sceneEl.textContent = state.scene;
  } catch (error) {
    scene = null;
    state = null;
    loadError = error.message;
    sceneEl.textContent = sceneUrl;
  }
  render();
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!manualTime && state) step(state, input(), dt);
  render();
  requestAnimationFrame(loop);
}

function input() {
  return {
    left: keys.has("arrowleft") || keys.has("a"),
    right: keys.has("arrowright") || keys.has("d"),
    up: keys.has("arrowup") || keys.has("w"),
    down: keys.has("arrowdown") || keys.has("s")
  };
}

function normalizeActions(actions) {
  if (Array.isArray(actions)) return actionsFromList(actions);
  if (typeof actions === "string") return actionsFromList([actions]);
  if (actions && typeof actions === "object" && ("actions" in actions || "action" in actions)) {
    for (const field of Object.keys(actions)) {
      if (!ACTION_OBJECT_FIELDS.has(field)) throw new Error(`advanceTime action object.${field} is unknown`);
    }
    if (actions.action !== undefined && actions.actions !== undefined) {
      throw new Error("advanceTime action object cannot use both action and actions");
    }
    if (actions.actions !== undefined && !Array.isArray(actions.actions)) {
      throw new Error("advanceTime action object.actions must be an array");
    }
    return actionsFromList(actions.actions ?? [actions.action]);
  }
  if (!actions || typeof actions !== "object") {
    throw new Error("advanceTime actions must be an action string, action array, action object, or boolean map");
  }
  actionsFromList(Object.keys(actions));
  for (const [action, pressed] of Object.entries(actions)) {
    if (typeof pressed !== "boolean") throw new Error(`action ${action} must be boolean`);
  }
  return actions;
}

function isMoveKey(key) {
  return ["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key.toLowerCase());
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shell.requestFullscreen();
  } catch {
    // Browser fullscreen can be denied outside a user gesture; gameplay should continue.
  }
  render();
}

function render() {
  draw();
  const snapshot = currentSnapshot();
  statusEl.textContent = snapshot.status;
  scoreEl.textContent = `Score ${snapshot.score}`;
  window.__AGE_STATE__ = snapshot;
}

function renderGameToText() {
  return JSON.stringify({
    coordinateSystem: "origin top-left, +x right, +y down, units tiles",
    timeMode: manualTime ? "manual" : "live",
    ...currentSnapshot()
  });
}

function currentSnapshot() {
  if (!state) {
    return {
      scene: scene?.name ?? sceneUrl,
      tick: 0,
      status: "error",
      score: 0,
      messages: loadError ? [loadError] : [],
      ...(loadError ? { error: loadError } : {}),
      entities: []
    };
  }
  return dumpState(state);
}

function draw() {
  if (!scene || !state) {
    ctx.fillStyle = "#121417";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0f3f6";
    ctx.font = "16px sans-serif";
    ctx.fillText("Scene error", 16, 32);
    return;
  }
  const scale = state.tileSize;
  ctx.fillStyle = scene.world.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#242932";
  for (let x = 0; x <= state.world.width; x += 1) line(x * scale, 0, x * scale, canvas.height);
  for (let y = 0; y <= state.world.height; y += 1) line(0, y * scale, canvas.width, y * scale);
  for (const entity of state.entities) {
    if (entity.collected) continue;
    const locked = entity.kind === "goal" && (entity.requiresScore ?? 0) > state.score;
    ctx.fillStyle = locked ? "#5f6b7a" : (entity.color ?? "#d8dee9");
    ctx.fillRect(entity.x * scale, entity.y * scale, entity.w * scale, entity.h * scale);
    if (locked) {
      ctx.strokeStyle = "#ffd166";
      line(entity.x * scale, (entity.y + entity.h) * scale, (entity.x + entity.w) * scale, entity.y * scale);
      ctx.strokeStyle = "#242932";
    }
  }
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
