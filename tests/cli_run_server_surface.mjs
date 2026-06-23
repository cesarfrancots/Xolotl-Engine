import { spawn } from "node:child_process";
import { createServer } from "node:net";

const port = await freePort();
const child = spawn(process.execPath, ["bin/engine.js", "run", "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
let stderr = "";
child.stderr.on("data", (chunk) => stderr += chunk);

try {
  await waitFor(`http://127.0.0.1:${port}/`);
  await expectStatus(port, "/", 200);
  await expectStatus(port, "/web/app.js", 200);
  await expectStatus(port, "/src/core.js", 200);
  await expectStatus(port, "/scenes/level_01.json", 200);
  await expectStatus(port, "/package.json", 403);
  await expectStatus(port, "/.git/config", 403);
  console.log("ok tests/cli_run_server_surface.mjs runner serve surface");
} finally {
  child.kill();
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url) {
  for (let i = 0; i < 80; i += 1) {
    if (child.exitCode !== null) throw new Error(`run exited early: ${stderr}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error(`runner did not start: ${stderr}`);
}

async function expectStatus(port, path, status) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  if (response.status !== status) throw new Error(`expected ${path} ${status}, got ${response.status}`);
}
