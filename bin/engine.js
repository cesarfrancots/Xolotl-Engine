import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createState, createTemplate, describeEngine, describeSchemas, dumpState, runTest, solveScene, validateScene, validateTest } from "../src/core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [command, ...args] = process.argv.slice(2);

try {
  if (command === "describe") {
    requireArgCount("describe", args, 0);
    console.log(JSON.stringify(describeEngine(), null, 2));
  }
  else if (command === "schema") {
    requireArgCount("schema", args, 0);
    console.log(JSON.stringify(describeSchemas(), null, 2));
  }
  else if (command === "template") {
    requireArgCount("template", args, 0, 1);
    console.log(JSON.stringify(createTemplate(args[0] ?? "scene"), null, 2));
  }
  else if (command === "catalog") {
    requireArgCount("catalog", args, 0);
    await catalog();
  }
  else if (command === "verify") {
    requireArgCount("verify", args, 0);
    await verify();
  }
  else if (command === "solve") await solveAll(await jsonFiles(args, "scenes"));
  else if (command === "check") await checkAll(await jsonFiles(args, "scenes"));
  else if (command === "test") for (const file of await jsonFiles(args, "tests")) await test(file);
  else if (command === "trace") await traceAll(await jsonFiles(args, "tests"));
  else if (command === "simulate") await simulate(...parseSimulateArgs(args));
  else if (command === "dump-state") {
    requireArgCount("dump-state", args, 0, 1);
    await dump(args[0] ?? "scenes/level_01.json");
  }
  else if (command === "run") {
    const hasSceneArg = args[0] && !args[0].startsWith("--");
    await run(hasSceneArg ? args[0] : "scenes/level_01.json", hasSceneArg ? args.slice(1) : args);
  }
  else usage(1);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function check(scenePath) {
  const result = await checkResult(scenePath);
  if (!result.ok) throw new Error(result.error);
  console.log(`ok ${scenePath}`);
}

async function checkAll(scenePaths) {
  for (const scenePath of scenePaths) {
    const result = await checkResult(scenePath);
    if (result.ok) console.log(`ok ${scenePath}`);
    else {
      console.log(`fail ${scenePath} ${result.error}`);
      process.exitCode = 1;
    }
  }
}

async function checkResult(scenePath) {
  try {
    const errors = validateScene(await readJson(scenePath));
    return errors.length ? { scene: scenePath, ok: false, error: errors.join("\n") } : { scene: scenePath, ok: true };
  } catch (caught) {
    return { scene: scenePath, ok: false, error: caught.message };
  }
}

async function verify() {
  const sceneFiles = await jsonFiles([], "scenes");
  const testFiles = await jsonFiles([], "tests");
  const scenes = [];
  const tests = [];
  for (const file of sceneFiles) {
    try {
      const { errors, solution } = await sceneResult(file);
      scenes.push({ file, ok: errors.length === 0 && solution.ok, errors, solution });
    } catch (caught) {
      scenes.push({ file, ok: false, errors: [caught.message], solution: null });
    }
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
    try {
      const { scene, errors, solution } = await sceneResult(file);
      const entities = Array.isArray(scene?.entities) ? scene.entities : [];
      const valid = errors.length === 0;
      scenes.push({
        file,
        name: scene?.name,
        ok: valid && solution.ok,
        valid,
        errors,
        world: scene?.world,
        entities: countBy(entities, "kind"),
        goals: entities.filter((entity) => entity.kind === "goal").map(({ id, requiresScore }) => ({ id, requiresScore })),
        solution: valid ? summarizeSolution(solution) : null
      });
    } catch (caught) {
      scenes.push({ file, ok: false, valid: false, errors: [caught.message], entities: {}, goals: [], solution: null });
    }
  }
  const tests = [];
  for (const file of await jsonFiles([], "tests")) {
    const result = await testResult(file);
    tests.push({
      file,
      scene: result.scene,
      ok: result.ok,
      validation: !!result.validation,
      status: result.status,
      tick: result.tick,
      error: result.error,
      validationErrors: result.validationErrors,
      testErrors: result.testErrors
    });
  }
  console.log(JSON.stringify({ scenes, tests }, null, 2));
}

async function solveAll(scenePaths) {
  const results = [];
  for (const scenePath of scenePaths) results.push(await solve(scenePath));
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

async function solve(scenePath) {
  let result;
  try {
    result = { scene: scenePath, ...solveScene(await readJson(scenePath)) };
  } catch (caught) {
    result = { scene: scenePath, ok: false, error: caught.message };
  }
  return result;
}

async function test(testPath) {
  const result = await testResult(testPath);
  if (!result.ok) {
    console.log(`fail ${testPath} ${result.error}`);
    process.exitCode = 1;
    return;
  }
  if (result.validation) console.log(`ok ${testPath} validation`);
  else console.log(`ok ${testPath} ${result.status} ${result.tick} ticks`);
}

async function testResult(testPath) {
  let spec;
  try {
    spec = await readJson(testPath);
  } catch (caught) {
    return { file: testPath, scene: null, ok: false, error: caught.message };
  }
  const scene = sceneLabel(spec);
  try {
    const testErrors = validateTest(spec);
    if (Array.isArray(spec.expect?.testErrors)) {
      return {
        file: testPath,
        scene,
        ok: true,
        validation: true,
        testErrors: assertExpectedErrors(testErrors, spec.expect.testErrors, "expected test errors, got none", "test error")
      };
    }
    if (testErrors.length) throw new Error(testErrors.join("\n"));
    const sceneData = await readScene(spec);
    if (spec.expect?.validationErrors) {
      return {
        file: testPath,
        scene,
        ok: true,
        validation: true,
        validationErrors: assertValidationErrors(sceneData, spec.expect.validationErrors)
      };
    }
    const state = runTest(sceneData, spec);
    return { file: testPath, scene, ok: true, status: state.status, tick: state.tick };
  } catch (caught) {
    return { file: testPath, scene, ok: false, error: caught.message };
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
  let spec;
  try {
    spec = await readJson(testPath);
  } catch (caught) {
    return { test: testPath, scene: null, ok: false, error: caught.message, steps: [], final: null };
  }
  const testErrors = validateTest(spec);
  if (Array.isArray(spec.expect?.testErrors)) {
    let error;
    let actualTestErrors = [];
    try {
      actualTestErrors = assertExpectedErrors(testErrors, spec.expect.testErrors, "expected test errors, got none", "test error");
    } catch (caught) {
      error = caught.message;
    }
    return { test: testPath, scene: sceneLabel(spec), ok: !error, error, testErrors: actualTestErrors, steps: [], final: null };
  }
  if (testErrors.length) return { test: testPath, scene: sceneLabel(spec), ok: false, error: testErrors.join("\n"), steps: [], final: null };
  let scene;
  try {
    scene = await readScene(spec);
  } catch (caught) {
    return { test: testPath, scene: sceneLabel(spec), ok: false, error: caught.message, steps: [], final: null };
  }
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
  const result = await simulateResult(scenePath, specSource);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

function parseSimulateArgs(args) {
  if (!args.length || looksLikeStepSpec(args[0])) return ["scenes/level_01.json", args.join(" ")];
  return [args[0], args.slice(1).join(" ")];
}

function looksLikeStepSpec(value) {
  return value.startsWith("[") || value.startsWith("{") || value.includes(":") || value.includes(",");
}

async function simulateResult(scenePath, specSource) {
  if (!scenePath) return { scene: null, ok: false, error: "simulate needs a scene file", steps: [], final: null };
  const traceSteps = [];
  try {
    const spec = await readStepSpec(specSource);
    const steps = stepsFromSpec(spec);
    const final = runTest(await readJson(scenePath), { steps }, (entry) => traceSteps.push(entry));
    return { scene: scenePath, ok: true, steps: traceSteps, final: dumpState(final) };
  } catch (caught) {
    return { scene: scenePath, ok: false, error: caught.message, steps: traceSteps, final: traceSteps.at(-1)?.state ?? null };
  }
}

async function dump(scenePath) {
  const state = createState(await readJson(scenePath));
  console.log(JSON.stringify(dumpState(state), null, 2));
}

async function sceneResult(file) {
  const scene = await readJson(file);
  const errors = validateScene(scene);
  return { scene, errors, solution: errors.length ? null : solveScene(scene) };
}

async function run(scenePath, args) {
  const { port } = parseRunArgs(args);
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
  server.once("error", (error) => {
    console.error(error.code === "EADDRINUSE" ? `run --port ${port} is already in use` : error.message);
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`running http://127.0.0.1:${port}/?scene=/${scenePath.replaceAll("\\", "/")}`);
  });
}

function parseRunArgs(args) {
  let port = 5173;
  let hasPort = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--port") throw new Error(`run arg ${args[index]} is unknown`);
    if (hasPort) throw new Error("run --port can only be set once");
    const value = Number(args[index + 1]);
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error("run --port must be an integer 1-65535");
    hasPort = true;
    port = value;
    index += 1;
  }
  return { port };
}

function requireArgCount(commandName, args, min, max = min) {
  if (args.length < min || args.length > max) {
    throw new Error(`${commandName} expects ${min === max ? min : `${min}-${max}`} argument${max === 1 ? "" : "s"}`);
  }
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
    const relative = path.relative(root, fullPath).replaceAll("\\", "/");
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    if (!["web/", "scenes/", "src/"].some((prefix) => relative.startsWith(prefix))) return null;
    return fullPath;
  } catch {
    return null;
  }
}

async function readJson(relativePath) {
  let text;
  try {
    text = (await readFile(path.resolve(root, relativePath), "utf8")).replace(/^\uFEFF/, "");
  } catch (error) {
    throw new Error(`cannot read JSON ${relativePath}: ${error.code ?? error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON in ${relativePath}: ${error.message}`);
  }
}

async function readStepSpec(source) {
  if (!source) return [];
  const trimmed = source.trim();
  if (trimmed.endsWith(".json")) return readJson(trimmed);
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`invalid step JSON: ${error.message}`);
    }
  }
  return parseStepShorthand(trimmed);
}

function parseStepShorthand(source) {
  return source.split(",").map((item) => {
    const parts = item.trim().split(":");
    if (parts.length !== 2) throw new Error("step shorthand must look like right:4,down:4");
    const [rawActions, rawFrames] = parts.map((part) => part.trim());
    const frames = Number(rawFrames);
    if (!rawActions || !Number.isInteger(frames) || frames < 1) throw new Error("step shorthand must look like right:4,down:4");
    const actions = ["idle", "none", "wait"].includes(rawActions) ? [] : rawActions.split("+").map((action) => action.trim());
    if (actions.some((action) => !action)) throw new Error("step shorthand must look like right:4,down:4");
    return { actions, frames };
  });
}

function stepsFromSpec(spec) {
  if (Array.isArray(spec)) return spec;
  if (!spec || typeof spec !== "object") throw new Error("step spec must be an array or object");
  for (const field of Object.keys(spec)) {
    if (field !== "steps") throw new Error(`step spec.${field} is unknown`);
  }
  return spec.steps ?? [];
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
  return { ok: result.ok, goal: result.goal, tick: result.tick, status: result.status, error: result.error, steps: result.steps?.length ?? 0 };
}

function sceneLabel(spec) {
  if (spec?.scene === undefined) return "missing";
  return typeof spec.scene === "string" ? spec.scene : "inline";
}

function assertValidationErrors(scene, expected) {
  const errors = validateScene(scene);
  return assertExpectedErrors(errors, expected, "expected validation errors, got none");
}

function assertExpectedErrors(errors, expected, emptyMessage, label = "validation error") {
  if (!expected.length) throw new Error(`expected ${label} list must contain at least one item`);
  for (const error of expected) {
    if (!errors.includes(error)) throw new Error(`expected ${label}: ${error}`);
  }
  if (!errors.length) throw new Error(emptyMessage);
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
