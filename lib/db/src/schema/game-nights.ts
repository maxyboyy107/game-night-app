import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ScorekeeperMode } from "@workspace/catalog";

export type GameNightVariationNode = {
  name: string;
  children: GameNightVariationNode[];
};

export const gameNightsTable = pgTable("game_nights", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  hostUserId: text("host_user_id").notNull(),
  accessMode: text("access_mode").notNull(),
  joinCode: text("join_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("game_nights_join_code_unique").on(table.joinCode),
  index("game_nights_host_idx").on(table.hostUserId),
]);

export const gameNightMembershipsTable = pgTable("game_night_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameNightId: uuid("game_night_id").notNull().references(() => gameNightsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  invitedBy: text("invited_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("game_night_memberships_night_user_unique").on(table.gameNightId, table.userId),
  index("game_night_memberships_user_status_idx").on(table.userId, table.status),
]);

export const gameNightProfilesTable = pgTable("game_night_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameNightId: uuid("game_night_id").notNull().references(() => gameNightsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdByUserId: text("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("game_night_profiles_night_name_unique").on(table.gameNightId, sql`lower(${table.name})`),
  index("game_night_profiles_night_active_idx").on(table.gameNightId, table.isActive),
]);

export const gameNightHouseRulesTable = pgTable("game_night_house_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameNightId: uuid("game_night_id").notNull().references(() => gameNightsTable.id, { onDelete: "cascade" }),
  gameSlug: text("game_slug").notNull(),
  rulesText: text("rules_text"),
  variation: text("variation"),
  rulesVersion: text("rules_version"),
  updatedByUserId: text("updated_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("game_night_house_rules_night_game_unique").on(table.gameNightId, table.gameSlug),
  index("game_night_house_rules_game_idx").on(table.gameSlug),
]);

export const gameNightLocalGamesTable = pgTable("game_night_local_games", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameNightId: uuid("game_night_id").notNull().references(() => gameNightsTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  minPlayers: integer("min_players").notNull().default(1),
  maxPlayers: integer("max_players").notNull().default(8),
  rules: text("rules").notNull().default(""),
  scorekeeperModes: jsonb("scorekeeper_modes").$type<ScorekeeperMode[]>().notNull(),
  variations: jsonb("variations").$type<string[]>().notNull().default([]),
  createdByUserId: text("created_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("game_night_local_games_night_slug_unique").on(table.gameNightId, table.slug),
  index("game_night_local_games_night_idx").on(table.gameNightId),
]);

export const gameNightGamesTable = pgTable("game_night_games", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameNightId: uuid("game_night_id").notNull().references(() => gameNightsTable.id, { onDelete: "cascade" }),
  gameSlug: text("game_slug").notNull(),
  title: text("title").notNull(),
  variationTree: jsonb("variation_tree").$type<GameNightVariationNode[]>().notNull().default([]),
  addedByUserId: text("added_by_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("game_night_games_night_slug_unique").on(table.gameNightId, table.gameSlug),
  index("game_night_games_night_idx").on(table.gameNightId),
]);
