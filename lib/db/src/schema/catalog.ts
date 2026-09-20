import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { CatalogState } from "@workspace/catalog";

export const catalogStateTable = pgTable("catalog_state", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").$type<CatalogState>().notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCatalogStateSchema = createInsertSchema(catalogStateTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCatalogState = z.infer<typeof insertCatalogStateSchema>;
export type CatalogStateRow = typeof catalogStateTable.$inferSelect;