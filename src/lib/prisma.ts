import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var prisma: PrismaClient | undefined;
}

function getPrismaClient() {
  if (global.prisma) return global.prisma;
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) throw new Error("DATABASE_URL environment variable is not set");
  const pool = new Pool({ connectionString: connectionUrl });
  const client = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });
  if (process.env.NODE_ENV !== "production") global.prisma = client;
  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
