import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required");

export const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined
});
