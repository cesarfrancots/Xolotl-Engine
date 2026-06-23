import { createState, dumpState, step } from "/src/core.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const statusEl = document.querySelector("#status");
const sceneEl = document.querySelector("#scene");
const scoreEl = document.querySelector("#score");
const reset = document.querySelector("#reset");
const keys = new Set();

const sceneUrl = new URLSearchParams(location.search).get("scene") ?? "/scenes/level_01.json";
const scene = await fetch(sceneUrl).then((res) => res.json());
let state = createState(scene);
let last = performance.now();

canvas.width = scene.world.width * scene.tileSize;
canvas.height = scene.world.height * scene.tileSize;
sceneEl.textContent = state.scene;
reset.addEventListener("click", () => {
  state = createState(scene);
  render();
});
addEventListener("keydown", (event) => {
  if (isMoveKey(event.key)) event.preventDefault();
  keys.add(event.key.toLowerCase());
});
addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms = 1000 / 60, actions = input()) => {
  const frames = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < frames; i += 1) step(state, actions, 1 / 60);
  last = performance.now();
  render();
  return renderGameToText();
};

render();
requestAnimationFrame(loop);

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(state, input(), dt);
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

function isMoveKey(key) {
  return ["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"].includes(key.toLowerCase());
}

function render() {
  draw();
  statusEl.textContent = state.status;
  scoreEl.textContent = `Score ${state.score}`;
  window.__AGE_STATE__ = dumpState(state);
}

function renderGameToText() {
  return JSON.stringify({
    coordinateSystem: "origin top-left, +x right, +y down, units tiles",
    ...dumpState(state)
  });
}

function draw() {
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
