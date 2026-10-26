import { readFile } from "node:fs/promises";
import { db } from "./client.js";

const migration = await readFile(new URL("./migrations/001_initial.sql", import.meta.url), "utf8");
const statements = migration.split("-- statement-break").map(s => s.trim()).filter(Boolean);
for (const sql of statements) await db.execute(sql);
console.log("Migration 001 applied.");
process.exit(0);
