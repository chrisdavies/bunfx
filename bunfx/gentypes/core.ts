/**
 * Database type generation.
 *
 * Generates TypeScript types from PostgreSQL or SQLite database schemas.
 */

import fs from "node:fs";
import path from "node:path";
import { SQL } from "bun";

// ============================================================================
// Types
// ============================================================================

export type OverrideMapping = {
  from: string;
  mappings: Record<string, string>;
};

export type GenTypesConfig = {
  output: string;
  overrides?: Record<string, OverrideMapping>;
};

export type GenTypesOptions = {
  connectionString: string;
  config: GenTypesConfig;
};

export type ColumnDef = {
  schemaName: string;
  tableName: string;
  columnName: string;
  columnDefault: string | null;
  isNullable: boolean;
  dataType: string;
  subType: string | null;
};

export type TableDef = {
  schemaName: string;
  tableName: string;
  columns: ColumnDef[];
};

export type SchemaDef = {
  name: string;
  tables: TableDef[];
};

export type DatabaseSchema = {
  isPostgres: boolean;
  schemas: SchemaDef[];
};

type ResolvedOverride = {
  namespace: string;
  typeName: string;
};

type OverrideContext = {
  byColumn: Map<string, ResolvedOverride>;
  imports: Map<string, { namespace: string; from: string }>;
  used: Set<string>;
};

type GeneratedFile = {
  filename: string;
  content: string;
};

// ============================================================================
// Utilities
// ============================================================================

function capitalizeFirst(s: string): string {
  const first = s[0];
  if (!first) return s;
  return first.toUpperCase() + s.slice(1);
}

function camelCase(s: string): string {
  const [prefix, ...rest] = s.split("_");
  return (prefix ?? "") + rest.map(capitalizeFirst).join("");
}

function pascalCase(s: string): string {
  return capitalizeFirst(camelCase(s));
}

function tableNameToTypeName(tableName: string): string {
  let name = pascalCase(tableName);
  if (name.endsWith("ies")) {
    name = `${name.slice(0, -3)}y`;
  } else if (name.endsWith("ses") || name.endsWith("xes")) {
    name = name.slice(0, -2);
  } else if (name.endsWith("s") && !name.endsWith("ss")) {
    name = name.slice(0, -1);
  }
  return `${name}Row`;
}

// ============================================================================
// Database Introspection - PostgreSQL
// ============================================================================

async function getPostgresSchemas(sql: SQL): Promise<string[]> {
  const rows = await sql<{ schemaName: string }[]>`
    SELECT schema_name "schemaName"
    FROM information_schema.schemata
    WHERE schema_name NOT LIKE 'pg_%'
      AND schema_name <> 'information_schema'
    ORDER BY schema_name
  `;
  return rows.map((r) => r.schemaName);
}

async function getPostgresTables(
  sql: SQL,
  schema: string,
): Promise<TableDef[]> {
  const columns = await sql<
    {
      schemaName: string;
      tableName: string;
      columnName: string;
      columnDefault: string | null;
      isNullable: string;
      dataType: string;
      subType: string | null;
    }[]
  >`
    SELECT
      table_schema "schemaName",
      table_name "tableName",
      column_name "columnName",
      column_default "columnDefault",
      is_nullable "isNullable",
      data_type "dataType",
      udt_name "subType"
    FROM information_schema.columns
    WHERE table_schema = ${schema}
      AND table_name NOT LIKE 'pg_%'
    ORDER BY table_name, ordinal_position
  `;

  const tableMap = new Map<string, TableDef>();

  for (const col of columns) {
    let table = tableMap.get(col.tableName);
    if (!table) {
      table = {
        schemaName: col.schemaName,
        tableName: col.tableName,
        columns: [],
      };
      tableMap.set(col.tableName, table);
    }
    table.columns.push({
      schemaName: col.schemaName,
      tableName: col.tableName,
      columnName: col.columnName,
      columnDefault: col.columnDefault,
      isNullable: col.isNullable === "YES",
      dataType: col.dataType,
      subType: col.subType,
    });
  }

  return Array.from(tableMap.values()).sort((a, b) =>
    a.tableName.localeCompare(b.tableName),
  );
}

async function introspectPostgres(sql: SQL): Promise<DatabaseSchema> {
  const schemaNames = await getPostgresSchemas(sql);
  const schemas: SchemaDef[] = [];

  for (const name of schemaNames) {
    const tables = await getPostgresTables(sql, name);
    if (tables.length > 0) {
      schemas.push({ name, tables });
    }
  }

  return { isPostgres: true, schemas };
}

// ============================================================================
// Database Introspection - SQLite
// ============================================================================

async function introspectSqlite(sql: SQL): Promise<DatabaseSchema> {
  const tables = await sql<{ name: string }[]>`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '_bunfx_%'
      AND name NOT LIKE 'bunfx_%'
    ORDER BY name
  `;

  const tableDefs: TableDef[] = [];

  for (const { name: tableName } of tables) {
    const columns = await sql.unsafe<
      {
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }[]
    >(`PRAGMA table_info("${tableName}")`);

    tableDefs.push({
      schemaName: "main",
      tableName,
      columns: columns.map((col) => ({
        schemaName: "main",
        tableName,
        columnName: col.name,
        columnDefault: col.dflt_value,
        isNullable: col.notnull === 0 && col.pk === 0,
        dataType: col.type.toLowerCase(),
        subType: null,
      })),
    });
  }

  return {
    isPostgres: false,
    schemas: [{ name: "main", tables: tableDefs }],
  };
}

// ============================================================================
// Database Introspection - Entry Point
// ============================================================================

export async function introspectDatabase(
  connectionString: string,
): Promise<DatabaseSchema> {
  const isPostgres = connectionString.startsWith("postgres");
  const sql = new SQL(connectionString);

  try {
    if (isPostgres) {
      return await introspectPostgres(sql);
    }
    return await introspectSqlite(sql);
  } finally {
    sql.close();
  }
}

// ============================================================================
// Type Mapping
// ============================================================================

function postgresTypeToTs(dataType: string, subType: string | null): string {
  switch (dataType.toLowerCase()) {
    case "integer":
    case "smallint":
    case "bigint":
    case "numeric":
    case "real":
    case "double precision":
      return "number";
    case "uuid":
      return "string";
    case "boolean":
      return "boolean";
    case "date":
    case "timestamp without time zone":
    case "timestamp with time zone":
      return "Date";
    case "character varying":
    case "character":
    case "text":
      return "string";
    case "jsonb":
    case "json":
      return "unknown";
    case "array": {
      if (subType) {
        const inner = postgresTypeToTs(subType.replace(/^_/, ""), null);
        return `${inner}[]`;
      }
      return "unknown[]";
    }
    case "bytea":
      return "Uint8Array";
    default:
      if (subType?.startsWith("_")) {
        const inner = postgresTypeToTs(subType.replace(/^_/, ""), null);
        return `${inner}[]`;
      }
      return "unknown";
  }
}

function sqliteTypeToTs(dataType: string): string {
  const normalized = dataType.toUpperCase();

  if (
    normalized.includes("INT") ||
    normalized.includes("REAL") ||
    normalized.includes("FLOAT") ||
    normalized.includes("DOUBLE") ||
    normalized.includes("NUMERIC")
  ) {
    return "number";
  }

  if (
    normalized.includes("CHAR") ||
    normalized.includes("TEXT") ||
    normalized.includes("CLOB")
  ) {
    return "string";
  }

  if (normalized.includes("BLOB") || normalized === "") {
    return "Uint8Array";
  }

  if (normalized.includes("BOOL")) {
    return "boolean";
  }

  return "unknown";
}

// ============================================================================
// Override Handling
// ============================================================================

function buildAllColumnsMap(
  dbSchema: DatabaseSchema,
): Map<string, Set<string>> {
  const allColumns = new Map<string, Set<string>>();

  for (const schema of dbSchema.schemas) {
    for (const table of schema.tables) {
      const key = `${schema.name}.${table.tableName}`;
      const cols = new Set(table.columns.map((c) => c.columnName));
      allColumns.set(key, cols);
    }
  }

  return allColumns;
}

function buildOverrideContext(
  config: GenTypesConfig,
  allColumns: Map<string, Set<string>>,
): OverrideContext {
  const ctx: OverrideContext = {
    byColumn: new Map(),
    imports: new Map(),
    used: new Set(),
  };

  if (!config.overrides) {
    return ctx;
  }

  for (const [namespace, override] of Object.entries(config.overrides)) {
    ctx.imports.set(namespace, { namespace, from: override.from });

    for (const [columnPath, typeName] of Object.entries(override.mappings)) {
      // Validate the column path exists
      const parts = columnPath.split(".");
      if (parts.length < 2 || parts.length > 3) {
        throw new Error(
          `Invalid column path "${columnPath}". Expected "schema.table.column" or "table.column".`,
        );
      }

      const [schemaOrTable, tableOrColumn, maybeColumn] = parts as [
        string,
        string,
        string | undefined,
      ];
      const schemaName = maybeColumn ? schemaOrTable : "main";
      const tableName = maybeColumn ? tableOrColumn : schemaOrTable;
      const columnName = maybeColumn ?? tableOrColumn;

      const tableKey = `${schemaName}.${tableName}`;
      const tableColumns = allColumns.get(tableKey);

      if (!tableColumns) {
        throw new Error(
          `Override references non-existent table "${tableKey}" in path "${columnPath}".`,
        );
      }

      if (!tableColumns.has(columnName)) {
        throw new Error(
          `Override references non-existent column "${columnName}" in table "${tableKey}".`,
        );
      }

      ctx.byColumn.set(columnPath, { namespace, typeName });
    }
  }

  return ctx;
}

function getColumnType(
  col: ColumnDef,
  isPostgres: boolean,
  overrideCtx: OverrideContext,
): string {
  // Check for override
  const fullPath = `${col.schemaName}.${col.tableName}.${col.columnName}`;
  const shortPath = `${col.tableName}.${col.columnName}`;

  const override =
    overrideCtx.byColumn.get(fullPath) ?? overrideCtx.byColumn.get(shortPath);

  if (override) {
    overrideCtx.used.add(fullPath);
    overrideCtx.used.add(shortPath);
    return `${override.namespace}.${override.typeName}`;
  }

  // Use default type mapping
  if (isPostgres) {
    return postgresTypeToTs(col.dataType, col.subType);
  }
  return sqliteTypeToTs(col.dataType);
}

function checkUnusedOverrides(
  config: GenTypesConfig,
  overrideCtx: OverrideContext,
): void {
  if (!config.overrides) return;

  const allMappedPaths = new Set<string>();
  for (const override of Object.values(config.overrides)) {
    for (const columnPath of Object.keys(override.mappings)) {
      allMappedPaths.add(columnPath);
    }
  }

  const unused: string[] = [];
  for (const columnPath of allMappedPaths) {
    if (!overrideCtx.used.has(columnPath)) {
      unused.push(columnPath);
    }
  }

  if (unused.length > 0) {
    throw new Error(`Unused overrides: ${unused.join(", ")}`);
  }
}

// ============================================================================
// Code Generation
// ============================================================================

function generateTableType(
  table: TableDef,
  isPostgres: boolean,
  overrideCtx: OverrideContext,
): string {
  const typeName = tableNameToTypeName(table.tableName);
  const lines: string[] = [];

  lines.push(`/** Table: ${table.tableName} */`);
  lines.push(`export type ${typeName} = {`);

  for (const col of table.columns) {
    const tsType = getColumnType(col, isPostgres, overrideCtx);
    const propName = camelCase(col.columnName);
    const optional = col.isNullable ? "?" : "";
    const nullUnion = col.isNullable ? " | null" : "";

    lines.push(`  ${propName}${optional}: ${tsType}${nullUnion};`);
  }

  lines.push("};");

  return lines.join("\n");
}

function generateInsertType(
  table: TableDef,
  isPostgres: boolean,
  overrideCtx: OverrideContext,
): string {
  const typeName = `Insert${tableNameToTypeName(table.tableName)}`;
  const lines: string[] = [];

  lines.push(`/** Insert type for: ${table.tableName} */`);
  lines.push(`export type ${typeName} = {`);

  for (const col of table.columns) {
    const tsType = getColumnType(col, isPostgres, overrideCtx);
    const propName = camelCase(col.columnName);
    const hasDefault = col.columnDefault !== null;
    const optional = col.isNullable || hasDefault ? "?" : "";
    const nullUnion = col.isNullable ? " | null" : "";

    lines.push(`  ${propName}${optional}: ${tsType}${nullUnion};`);
  }

  lines.push("};");

  return lines.join("\n");
}

function generateSchemaFileContent(
  tables: TableDef[],
  isPostgres: boolean,
  overrideCtx: OverrideContext,
): string {
  const lines: string[] = [];

  lines.push("// This file is auto-generated. Do not edit directly.");
  lines.push("");

  // Add imports for overrides used in this schema
  const usedNamespaces = new Set<string>();
  for (const table of tables) {
    for (const col of table.columns) {
      const fullPath = `${col.schemaName}.${col.tableName}.${col.columnName}`;
      const shortPath = `${col.tableName}.${col.columnName}`;
      const override =
        overrideCtx.byColumn.get(fullPath) ??
        overrideCtx.byColumn.get(shortPath);
      if (override) {
        usedNamespaces.add(override.namespace);
      }
    }
  }

  for (const ns of usedNamespaces) {
    const imp = overrideCtx.imports.get(ns);
    if (imp) {
      lines.push(`import type * as ${ns} from "${imp.from}";`);
    }
  }

  if (usedNamespaces.size > 0) {
    lines.push("");
  }

  // Generate types for each table
  for (const table of tables) {
    lines.push(generateTableType(table, isPostgres, overrideCtx));
    lines.push("");
    lines.push(generateInsertType(table, isPostgres, overrideCtx));
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// File Generation - Pure Function
// ============================================================================

export function generateTypeFiles(
  dbSchema: DatabaseSchema,
  config: GenTypesConfig,
): GeneratedFile[] {
  const allColumns = buildAllColumnsMap(dbSchema);
  const overrideCtx = buildOverrideContext(config, allColumns);
  const files: GeneratedFile[] = [];

  if (dbSchema.isPostgres) {
    // Generate one file per schema for PostgreSQL
    for (const schema of dbSchema.schemas) {
      const content = generateSchemaFileContent(
        schema.tables,
        true,
        overrideCtx,
      );
      files.push({
        filename: `${schema.name}.ts`,
        content,
      });
    }
  } else {
    // Generate single file for SQLite
    const allTables = dbSchema.schemas.flatMap((s) => s.tables);
    const content = generateSchemaFileContent(allTables, false, overrideCtx);
    files.push({
      filename: "db.ts",
      content,
    });
  }

  // Check for unused overrides
  checkUnusedOverrides(config, overrideCtx);

  return files;
}

// ============================================================================
// Main Entry Point
// ============================================================================

export async function generateTypes(opts: GenTypesOptions): Promise<void> {
  const { connectionString, config } = opts;

  console.log("Introspecting database...");
  const dbSchema = await introspectDatabase(connectionString);

  const schemaCount = dbSchema.schemas.length;
  const tableCount = dbSchema.schemas.reduce(
    (sum, s) => sum + s.tables.length,
    0,
  );
  console.log(
    `Found ${tableCount} tables across ${schemaCount} schema${schemaCount === 1 ? "" : "s"}`,
  );

  const files = generateTypeFiles(dbSchema, config);

  fs.mkdirSync(config.output, { recursive: true });

  for (const file of files) {
    const filepath = path.join(config.output, file.filename);
    fs.writeFileSync(filepath, file.content, "utf8");
    console.log(`Generated ${filepath}`);
  }

  console.log("Done.");
}
