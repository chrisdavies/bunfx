#!/usr/bin/env bun

import { z } from "zod";
import { sql } from "../src/db";

const email = z.email().safeParse(process.argv[2]);

if (!email.success) {
  console.error("Usage: bun scripts/adduser.ts <email>");
  console.error("Invalid or missing email address");
  process.exit(1);
}

const id = crypto.randomUUID();
const now = new Date().toISOString();

try {
  await sql`
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES (${id}, ${email.data}, ${now}, ${now})
  `;
  console.log(`Created user: ${email.data} (${id})`);
} catch (err) {
  if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
    console.error(`User already exists: ${email.data}`);
    process.exit(1);
  }
  throw err;
}
