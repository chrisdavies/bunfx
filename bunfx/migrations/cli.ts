import { type Command, migrate } from "./migrate";

const COMMANDS: Command[] = ["new", "up", "down", "sync"];

// argv: [bun, script.ts, command, ...args]
const args = process.argv.slice(2);
const command = args[0] as Command | undefined;

if (!command || !COMMANDS.includes(command)) {
  printUsage();
  process.exit(command ? 1 : 0);
}

try {
  await migrate({
    command,
    migrationsDirectory: process.env.MIGRATIONS_DIR ?? "./migrations",
    connectionString: process.env.DATABASE_URL ?? "",
    name: args[1],
  });
} catch (error) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    throw error;
  }
  process.exit(1);
}

function printUsage() {
  console.log(`
Usage: bun migrate <command> [options]

Commands:
  new <name>    Create a new migration file
  up            Run pending migrations
  down          Rollback the latest migration
  sync          Sync database with local migrations (dev only)

Environment:
  MIGRATIONS_DIR    Migration folder (default: ./migrations)
  DATABASE_URL      Database connection string
`);
}
