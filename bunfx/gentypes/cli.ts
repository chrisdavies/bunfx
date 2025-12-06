/**
 * CLI entry point for database type generation.
 *
 * Usage:
 *   bun bunfx/gentypes/cli.ts [--config path/to/config.ts]
 *
 * Environment:
 *   DATABASE_URL - Database connection string (required)
 *
 * Config file (db.config.ts by default):
 *   export default {
 *     output: "./src/generated",
 *     overrides: {
 *       MyTypes: {
 *         from: "./src/types/overrides",
 *         mappings: {
 *           "public.users.role": "UserRole",
 *         },
 *       },
 *     },
 *   };
 */

import path from "node:path";
import { type GenTypesConfig, generateTypes } from "./core";

function printUsage() {
  console.log(`
Usage: bun bunfx/gentypes/cli.ts [--config path/to/config.ts]

Environment:
  DATABASE_URL  Database connection string (required)

Options:
  --config      Path to config file (default: db.config.ts)
  --help        Show this help message

Example config (db.config.ts):
  export default {
    output: "./src/generated",
    overrides: {
      MyTypes: {
        from: "./src/types/overrides",
        mappings: {
          "public.users.role": "UserRole",
        },
      },
    },
  };
`);
}

async function loadConfig(configPath: string): Promise<GenTypesConfig> {
  const absolutePath = path.resolve(process.cwd(), configPath);
  try {
    const mod = await import(absolutePath);
    return mod.default as GenTypesConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(`Config file not found: ${absolutePath}`);
    }
    throw err;
  }
}

async function run() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  // Parse --config argument
  let configPath = "db.config.ts";
  const configIndex = args.indexOf("--config");
  if (configIndex >= 0) {
    const configValue = args[configIndex + 1];
    if (!configValue || configValue.startsWith("-")) {
      console.error("Error: --config requires a path argument");
      process.exit(1);
    }
    configPath = configValue;
  }

  // Get connection string from environment
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Error: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  // Load config
  const config = await loadConfig(configPath);

  // Run generation
  await generateTypes({
    connectionString,
    config,
  });
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
