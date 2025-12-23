import { describe, expect, test } from "bun:test";
import {
  type DatabaseSchema,
  type GenTypesConfig,
  generateTypeFiles,
} from "./core";

// ============================================================================
// Test Helpers
// ============================================================================

function makeSchema(
  tables: DatabaseSchema["schemas"][0]["tables"],
): DatabaseSchema {
  return {
    isPostgres: false,
    schemas: [{ name: "main", tables }],
  };
}

function makePostgresSchema(
  schemas: Array<{
    name: string;
    tables: DatabaseSchema["schemas"][0]["tables"];
  }>,
): DatabaseSchema {
  return {
    isPostgres: true,
    schemas,
  };
}

function makeTable(
  name: string,
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    default?: string | null;
  }>,
): DatabaseSchema["schemas"][0]["tables"][0] {
  return {
    schemaName: "main",
    tableName: name,
    columns: columns.map((col) => ({
      schemaName: "main",
      tableName: name,
      columnName: col.name,
      dataType: col.type,
      isNullable: col.nullable ?? false,
      columnDefault: col.default ?? null,
      subType: null,
    })),
  };
}

function getContent(
  files: ReturnType<typeof generateTypeFiles>,
  index = 0,
): string {
  const file = files[index];
  if (!file) throw new Error(`No file at index ${index}`);
  return file.content;
}

function getFilename(
  files: ReturnType<typeof generateTypeFiles>,
  index = 0,
): string {
  const file = files[index];
  if (!file) throw new Error(`No file at index ${index}`);
  return file.filename;
}

// ============================================================================
// Tests
// ============================================================================

describe("generateTypeFiles", () => {
  describe("basic type generation", () => {
    test("generates types for a simple table", () => {
      const schema = makeSchema([
        makeTable("users", [
          { name: "id", type: "integer" },
          { name: "name", type: "text" },
          { name: "email", type: "text", nullable: true },
        ]),
      ]);

      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);

      expect(files).toHaveLength(1);
      expect(getFilename(files)).toBe("db.ts");

      const content = getContent(files);
      expect(content).toContain("export type UserRow = {");
      expect(content).toContain("id: number;");
      expect(content).toContain("name: string;");
      expect(content).toContain("email?: string | null;");
    });

    test("generates insert types with optional defaults", () => {
      const schema = makeSchema([
        makeTable("users", [
          { name: "id", type: "integer" },
          { name: "name", type: "text" },
          { name: "created_at", type: "text", default: "CURRENT_TIMESTAMP" },
        ]),
      ]);

      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain("export type InsertUserRow = {");
      // id and name are required in insert
      expect(content).toMatch(/InsertUserRow[\s\S]*?id: number;/);
      expect(content).toMatch(/InsertUserRow[\s\S]*?name: string;/);
      // created_at is optional because it has a default
      expect(content).toMatch(/InsertUserRow[\s\S]*?created_at\?: string;/);
    });

    test("generates types for multiple tables", () => {
      const schema = makeSchema([
        makeTable("users", [{ name: "id", type: "integer" }]),
        makeTable("posts", [
          { name: "id", type: "integer" },
          { name: "user_id", type: "integer" },
        ]),
      ]);

      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain("export type UserRow = {");
      expect(content).toContain("export type PostRow = {");
      expect(content).toContain("user_id: number;");
    });
  });

  describe("table name handling", () => {
    test("handles plural table names correctly", () => {
      const schema = makeSchema([
        makeTable("companies", [{ name: "id", type: "integer" }]),
        makeTable("addresses", [{ name: "id", type: "integer" }]),
        makeTable("statuses", [{ name: "id", type: "integer" }]),
        makeTable("boxes", [{ name: "id", type: "integer" }]),
      ]);

      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain("export type CompanyRow = {");
      expect(content).toContain("export type AddressRow = {");
      expect(content).toContain("export type StatusRow = {");
      expect(content).toContain("export type BoxRow = {");
    });

    test("preserves snake_case for properties", () => {
      const schema = makeSchema([
        makeTable("users", [
          { name: "first_name", type: "text" },
          { name: "last_name", type: "text" },
          { name: "created_at", type: "text" },
        ]),
      ]);

      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain("first_name: string;");
      expect(content).toContain("last_name: string;");
      expect(content).toContain("created_at: string;");
    });
  });

  describe("SQLite type mapping", () => {
    test("maps SQLite types correctly", () => {
      const schema = makeSchema([
        makeTable("test_types", [
          { name: "int_col", type: "integer", nullable: true },
          { name: "real_col", type: "real", nullable: true },
          { name: "text_col", type: "text", nullable: true },
          { name: "blob_col", type: "blob", nullable: true },
          { name: "bool_col", type: "boolean", nullable: true },
          { name: "varchar_col", type: "varchar(255)", nullable: true },
          { name: "numeric_col", type: "numeric", nullable: true },
        ]),
      ]);

      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain("int_col?: number | null;");
      expect(content).toContain("real_col?: number | null;");
      expect(content).toContain("text_col?: string | null;");
      expect(content).toContain("blob_col?: Uint8Array | null;");
      expect(content).toContain("bool_col?: boolean | null;");
      expect(content).toContain("varchar_col?: string | null;");
      expect(content).toContain("numeric_col?: number | null;");
    });
  });

  describe("PostgreSQL", () => {
    test("generates one file per schema", () => {
      const schema = makePostgresSchema([
        {
          name: "public",
          tables: [
            {
              schemaName: "public",
              tableName: "users",
              columns: [
                {
                  schemaName: "public",
                  tableName: "users",
                  columnName: "id",
                  dataType: "integer",
                  isNullable: false,
                  columnDefault: null,
                  subType: null,
                },
              ],
            },
          ],
        },
        {
          name: "auth",
          tables: [
            {
              schemaName: "auth",
              tableName: "sessions",
              columns: [
                {
                  schemaName: "auth",
                  tableName: "sessions",
                  columnName: "id",
                  dataType: "uuid",
                  isNullable: false,
                  columnDefault: null,
                  subType: null,
                },
              ],
            },
          ],
        },
      ]);

      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.filename).sort()).toEqual([
        "auth.ts",
        "public.ts",
      ]);

      const publicFile = files.find((f) => f.filename === "public.ts");
      expect(publicFile?.content).toContain("export type UserRow = {");

      const authFile = files.find((f) => f.filename === "auth.ts");
      expect(authFile?.content).toContain("export type SessionRow = {");
    });

    test("maps PostgreSQL types correctly", () => {
      const schema = makePostgresSchema([
        {
          name: "public",
          tables: [
            {
              schemaName: "public",
              tableName: "test_types",
              columns: [
                {
                  schemaName: "public",
                  tableName: "test_types",
                  columnName: "uuid_col",
                  dataType: "uuid",
                  isNullable: true,
                  columnDefault: null,
                  subType: null,
                },
                {
                  schemaName: "public",
                  tableName: "test_types",
                  columnName: "json_col",
                  dataType: "jsonb",
                  isNullable: true,
                  columnDefault: null,
                  subType: null,
                },
                {
                  schemaName: "public",
                  tableName: "test_types",
                  columnName: "ts_col",
                  dataType: "timestamp with time zone",
                  isNullable: true,
                  columnDefault: null,
                  subType: null,
                },
                {
                  schemaName: "public",
                  tableName: "test_types",
                  columnName: "bytea_col",
                  dataType: "bytea",
                  isNullable: true,
                  columnDefault: null,
                  subType: null,
                },
                {
                  schemaName: "public",
                  tableName: "test_types",
                  columnName: "text_arr",
                  dataType: "ARRAY",
                  isNullable: true,
                  columnDefault: null,
                  subType: "_text",
                },
              ],
            },
          ],
        },
      ]);

      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain("uuid_col?: string | null;");
      expect(content).toContain("json_col?: unknown | null;");
      expect(content).toContain("ts_col?: Date | null;");
      expect(content).toContain("bytea_col?: Uint8Array | null;");
      expect(content).toContain("text_arr?: string[] | null;");
    });
  });

  describe("overrides", () => {
    test("applies type overrides from config", () => {
      const schema = makeSchema([
        makeTable("users", [
          { name: "id", type: "integer" },
          { name: "role", type: "text" },
        ]),
      ]);

      const config: GenTypesConfig = {
        output: "./out",
        overrides: {
          Types: {
            from: "./overrides",
            mappings: {
              "users.role": "UserRole",
            },
          },
        },
      };

      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain('import type * as Types from "../overrides";');
      expect(content).toContain("role: Types.UserRole;");
    });

    test("supports full path overrides for postgres", () => {
      const schema = makePostgresSchema([
        {
          name: "auth",
          tables: [
            {
              schemaName: "auth",
              tableName: "users",
              columns: [
                {
                  schemaName: "auth",
                  tableName: "users",
                  columnName: "role",
                  dataType: "text",
                  isNullable: false,
                  columnDefault: null,
                  subType: null,
                },
              ],
            },
          ],
        },
      ]);

      const config: GenTypesConfig = {
        output: "./out",
        overrides: {
          Types: {
            from: "./overrides",
            mappings: {
              "auth.users.role": "UserRole",
            },
          },
        },
      };

      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain("role: Types.UserRole;");
    });

    test("throws error for non-existent table in override", () => {
      const schema = makeSchema([
        makeTable("users", [{ name: "id", type: "integer" }]),
      ]);

      const config: GenTypesConfig = {
        output: "./out",
        overrides: {
          Types: {
            from: "./overrides",
            mappings: {
              "posts.title": "PostTitle",
            },
          },
        },
      };

      expect(() => generateTypeFiles(schema, config)).toThrow(
        'non-existent table "main.posts"',
      );
    });

    test("throws error for non-existent column in override", () => {
      const schema = makeSchema([
        makeTable("users", [{ name: "id", type: "integer" }]),
      ]);

      const config: GenTypesConfig = {
        output: "./out",
        overrides: {
          Types: {
            from: "./overrides",
            mappings: {
              "users.role": "UserRole",
            },
          },
        },
      };

      expect(() => generateTypeFiles(schema, config)).toThrow(
        'non-existent column "role"',
      );
    });

    test("throws error for unused overrides", () => {
      const schema = makeSchema([
        makeTable("users", [
          { name: "id", type: "integer" },
          { name: "role", type: "text" },
        ]),
      ]);

      const config: GenTypesConfig = {
        output: "./out",
        overrides: {
          Types: {
            from: "./overrides",
            mappings: {
              "users.role": "UserRole",
              "users.status": "UserStatus", // doesn't exist
            },
          },
        },
      };

      expect(() => generateTypeFiles(schema, config)).toThrow(
        'non-existent column "status"',
      );
    });

    test("supports multiple override namespaces", () => {
      const schema = makeSchema([
        makeTable("users", [
          { name: "role", type: "text" },
          { name: "status", type: "text" },
        ]),
      ]);

      const config: GenTypesConfig = {
        output: "./out",
        overrides: {
          Auth: {
            from: "./auth-types",
            mappings: { "users.role": "UserRole" },
          },
          Common: {
            from: "./common-types",
            mappings: { "users.status": "Status" },
          },
        },
      };

      const files = generateTypeFiles(schema, config);
      const content = getContent(files);

      expect(content).toContain('import type * as Auth from "../auth-types";');
      expect(content).toContain(
        'import type * as Common from "../common-types";',
      );
      expect(content).toContain("role: Auth.UserRole;");
      expect(content).toContain("status: Common.Status;");
    });
  });

  describe("edge cases", () => {
    test("handles empty schema", () => {
      const schema = makeSchema([]);
      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);

      expect(files).toHaveLength(1);
      expect(getContent(files)).toContain("// This file is auto-generated");
    });

    test("handles table with no columns", () => {
      const schema = makeSchema([makeTable("empty_table", [])]);
      const config: GenTypesConfig = { output: "./out" };
      const files = generateTypeFiles(schema, config);

      expect(getContent(files)).toContain("export type EmptyTableRow = {");
      expect(getContent(files)).toContain("};");
    });
  });
});
