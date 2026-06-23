import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createState, createTemplate, describeEngine, describeSchemas, dumpState, runTest, solveScene, validateScene } from "../src/core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);

try {
  if (command === "describe") console.log(JSON.stringify(describeEngine(), null, 2));
  else if (command === "schema") console.log(JSON.stringify(describeSchemas(), null, 2));
  else if (command === "template") console.log(JSON.stringify(createTemplate(args[0] ?? "scene"), null, 2));
  else if (command === "catalog") await catalog();
  else if (command === "verify") await verify();
  else if (command === "solve") for (const file of await jsonFiles(args, "scenes")) await solve(file);
  else if (command === "check") for (const file of await jsonFiles(args, "scenes")) await check(file);
  else if (command === "test") for (const file of await jsonFiles(args, "tests")) await test(file);
  else if (command === "trace") await traceAll(await jsonFiles(args, "tests"));
  else if (command === "simulate") await simulate(args[0], args[1]);
  else if (command === "dump-state") await dump(args[0] ?? "scenes/level_01.json");
  else if (command === "run") await run(args[0] ?? "scenes/level_01.json", args.slice(1));
  else usage(1);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function check(scenePath) {
  const scene = await readJson(scenePath);
  const errors = validateScene(scene);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`ok ${scenePath}`);
}

async function verify() {
  const sceneFiles = await jsonFiles([], "scenes");
  const testFiles = await jsonFiles([], "tests");
  const scenes = [];
  const tests = [];
  for (const file of sceneFiles) {
    const scene = await readJson(file);
    const errors = validateScene(scene);
    const solution = errors.length ? null : solveScene(scene);
    scenes.push({ file, ok: errors.length === 0 && solution.ok, errors, solution });
  }
  for (const file of testFiles) tests.push(await testResult(file));
  const result = {
    ok: scenes.every((item) => item.ok) && tests.every((item) => item.ok),
    scenes,
    tests
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function catalog() {
  const scenes = [];
  for (const file of await jsonFiles([], "scenes")) {
    const scene = await readJson(file);
    const errors = validateScene(scene);
    scenes.push({
      file,
      name: scene?.name,
      ok: errors.length === 0,
      errors,
      world: scene?.world,
      entities: countBy(scene?.entities ?? [], "kind"),
      goals: (scene?.entities ?? []).filter((entity) => entity.kind === "goal").map(({ id, requiresScore }) => ({ id, requiresScore })),
      solution: errors.length ? null : summarizeSolution(solveScene(scene))
    });
  }
  const tests = [];
  for (const file of await jsonFiles([], "tests")) {
    const result = await testResult(file);
    tests.push({ file, ok: result.ok, validation: !!result.validation, status: result.status, tick: result.tick, error: result.error });
  }
  console.log(JSON.stringify({ scenes, tests }, null, 2));
}

async function solve(scenePath) {
  const result = { scene: scenePath, ...solveScene(await readJson(scenePath)) };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function test(testPath) {
  const result = await testResult(testPath);
  if (!result.ok) throw new Error(result.error);
  if (result.validation) console.log(`ok ${testPath} validation`);
  else console.log(`ok ${testPath} ${result.status} ${result.tick} ticks`);
}

async function testResult(testPath) {
  const spec = await readJson(testPath);
  const scene = await readScene(spec);
  try {
    if (spec.expect?.validationErrors) {
      return {
        file: testPath,
        ok: true,
        validation: true,
        validationErrors: assertValidationErrors(scene, spec.expect.validationErrors)
      };
    }
    const state = runTest(scene, spec);
    return { file: testPath, ok: true, status: state.status, tick: state.tick };
  } catch (caught) {
    return { file: testPath, ok: false, error: caught.message };
  }
}

async function traceAll(files) {
  const traces = [];
  for (const file of files) {
    const result = await trace(file);
    traces.push(result);
    if (!result.ok) process.exitCode = 1;
  }
  console.log(JSON.stringify(traces, null, 2));
}

async function trace(testPath) {
  const spec = await readJson(testPath);
  const scene = await readScene(spec);
  if (spec.expect?.validationErrors) {
    let error;
    let validationErrors = [];
    try {
      validationErrors = assertValidationErrors(scene, spec.expect.validationErrors);
    } catch (caught) {
      error = caught.message;
    }
    return { test: testPath, scene: sceneLabel(spec), ok: !error, error, validationErrors, steps: [], final: null };
  }
  const steps = [];
  let error;
  let final;
  try {
    final = dumpState(runTest(scene, spec, (entry) => steps.push(entry)));
  } catch (caught) {
    error = caught.message;
    final = steps.at(-1)?.state ?? null;
  }
  return { test: testPath, scene: sceneLabel(spec), ok: !error, error, steps, final };
}

async function simulate(scenePath, specSource) {
  if (!scenePath) throw new Error("simulate needs a scene file");
  const spec = await readStepSpec(specSource);
  const steps = Array.isArray(spec) ? spec : spec.steps ?? [];
  const traceSteps = [];
  const final = runTest(await readJson(scenePath), { steps }, (entry) => traceSteps.push(entry));
  console.log(JSON.stringify({ scene: scenePath, ok: true, steps: traceSteps, final: dumpState(final) }, null, 2));
}

async function dump(scenePath) {
  const state = createState(await readJson(scenePath));
  console.log(JSON.stringify(dumpState(state), null, 2));
}

async function run(scenePath, args) {
  const port = Number(args[args.indexOf("--port") + 1]) || 5173;
  await check(scenePath);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const fullPath = resolveServedPath(url.pathname);
    if (!fullPath) return send(res, 403, "nope");
    try {
      const body = await readFile(fullPath);
      send(res, 200, body, mime(fullPath));
    } catch {
      send(res, 404, "not found");
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`running http://127.0.0.1:${port}/?scene=/${scenePath.replaceAll("\\", "/")}`);
  });
}

async function jsonFiles(files, dir) {
  if (files.length) return files;
  const found = (await readdir(path.join(root, dir)))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => `${dir}/${file}`);
  if (!found.length) throw new Error(`no json files in ${dir}`);
  return found;
}

function resolveServedPath(pathname) {
  try {
    const requestPath = decodeURIComponent(pathname === "/" ? "/web/index.html" : pathname).replaceAll("\\", "/");
    const fullPath = path.resolve(root, `.${requestPath}`);
    const relative = path.relative(root, fullPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return fullPath;
  } catch {
    return null;
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.resolve(root, relativePath), "utf8"));
}

async function readStepSpec(source) {
  if (!source) return [];
  const trimmed = source.trim();
  if (trimmed.endsWith(".json")) return readJson(source);
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return JSON.parse(source);
  return parseStepShorthand(trimmed);
}

function parseStepShorthand(source) {
  return source.split(",").filter(Boolean).map((item) => {
    const [rawActions, rawFrames] = item.split(":");
    const frames = Number(rawFrames);
    if (!rawActions || !Number.isInteger(frames) || frames < 1) throw new Error("step shorthand must look like right:4,down:4");
    const actions = ["idle", "none", "wait"].includes(rawActions) ? [] : rawActions.split("+").filter(Boolean);
    return { actions, frames };
  });
}

async function readScene(spec) {
  return typeof spec.scene === "string" ? readJson(spec.scene) : spec.scene;
}

function countBy(items, field) {
  const counts = {};
  for (const item of items) counts[item?.[field] ?? "unknown"] = (counts[item?.[field] ?? "unknown"] ?? 0) + 1;
  return counts;
}

function summarizeSolution(result) {
  return { ok: result.ok, tick: result.tick, status: result.status, error: result.error, steps: result.steps?.length ?? 0 };
}

function sceneLabel(spec) {
  return typeof spec.scene === "string" ? spec.scene : "inline";
}

function assertValidationErrors(scene, expected) {
  const errors = validateScene(scene);
  for (const error of expected) {
    if (!errors.includes(error)) throw new Error(`expected validation error: ${error}`);
  }
  if (!errors.length) throw new Error("expected validation errors, got none");
  return errors;
}

function send(res, status, body, type = "text/plain") {
  res.writeHead(status, { "content-type": type });
  res.end(body);
}

function mime(file) {
  if (file.endsWith(".html")) return "text/html";
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".js")) return "text/javascript";
  if (file.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function usage(code) {
  console.log("usage: node bin/engine.js describe|schema|template|catalog|verify|solve|check|test|trace|simulate|dump-state|run [file...]");
  process.exit(code);
}
