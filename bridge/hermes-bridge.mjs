#!/usr/bin/env node
import { main } from "./src/main.mjs";

main(process.argv.slice(2)).catch((error) => {
  console.error("[automatic-bridge] fatal", error?.stack || error?.message || error);
  process.exit(1);
});
