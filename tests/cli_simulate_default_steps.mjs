import { execFileSync } from "node:child_process";

const output = execFileSync(process.execPath, ["bin/engine.js", "simulate", "right:1"], { encoding: "utf8" });
const result = JSON.parse(output);
const schema = JSON.parse(execFileSync(process.execPath, ["bin/engine.js", "schema"], { encoding: "utf8" }));
const contract = JSON.parse(execFileSync(process.execPath, ["bin/engine.js", "describe"], { encoding: "utf8" }));

if (!result.ok) throw new Error(result.error);
if (result.scene !== "scenes/level_01.json") throw new Error(`expected default scene, got ${result.scene}`);
if (result.final.tick !== 1) throw new Error(`expected tick 1, got ${result.final.tick}`);
if (!schema.test.xXolotlValidation?.includes("step without frames/seconds advances one frame")) throw new Error("missing test schema timing annotation");
if (!contract.tests.includes?.includes("tests/cli_run_server_surface.mjs")) throw new Error("missing run-server smoke in test metadata");

console.log("ok tests/cli_simulate_default_steps.mjs default-scene shorthand");
