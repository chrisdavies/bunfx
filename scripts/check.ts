import { $ } from "bun";

const results = await Promise.allSettled([
  $`biome check bunfx/ secrets-share/`,
  $`cd bunfx && tsc --noEmit`,
  $`cd secrets-share && tsc --noEmit`,
]);

let failed = false;
for (const result of results) {
  if (result.status === "rejected" || result.value.exitCode !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
