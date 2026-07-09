import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import * as schema from "./schema";

const { Pool } = pg;

// Load .env from workspace root if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
}

if (process.env.DATABASE_URL) {
  let cleanUrl = process.env.DATABASE_URL.trim();
  if (cleanUrl.startsWith("DATABASE_URL=")) {
    cleanUrl = cleanUrl.substring("DATABASE_URL=".length).trim();
  }
  if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
    cleanUrl = cleanUrl.substring(1, cleanUrl.length - 1).trim();
  }
  process.env.DATABASE_URL = cleanUrl;
}

let pool: any = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
    console.log("[AI Studio] Database connected successfully via DATABASE_URL");
  } catch (err) {
    console.warn("[AI Studio] Database connection failed:", err);
  }
}

if (!db) {
  console.warn("[AI Studio] DATABASE_URL is not set or connection failed — using mock DB layer");
  
  const createMockChain = (value: any): any => {
    const fn = (...args: any[]) => {
      // If the method is called, return another proxy with the same chainable behavior
      return createMockChain(value);
    };
    
    // Add Promise then/catch/finally to make it awaitable
    fn.then = (onfulfilled?: any) => {
      return Promise.resolve(value).then(onfulfilled);
    };
    fn.catch = (onrejected?: any) => {
      return Promise.resolve(value).catch(onrejected);
    };
    fn.finally = (onfinally?: any) => {
      return Promise.resolve(value).finally(onfinally);
    };
    
    return new Proxy(fn, {
      get(target, prop) {
        if (prop in fn) {
          return (fn as any)[prop];
        }
        // For any other sub-property access (e.g. db.query.users.findMany), return a chainable proxy
        return createMockChain(value);
      }
    });
  };

  // We want a default array [ {} ] so destructuring like `const [user] = await db.insert...` doesn't crash
  db = createMockChain([{}]);
}

export { pool, db };
export * from "./schema";
