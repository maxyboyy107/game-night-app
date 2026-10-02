import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type SessionPlayerScore = {
  name: string;
  score: number;
  isYou: boolean;
};

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  username: text("username").notNull(),
  avatarPath: text("avatar_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("user_profiles_username_lower_unique").on(sql`lower(${table.username})`),
]);

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;

export const gameFavoritesTable = pgTable("game_favorites", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  gameSlug: text("game_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("game_favorites_user_game_unique").on(table.userId, table.gameSlug),
]);

export const insertGameFavoriteSchema = createInsertSchema(gameFavoritesTable).omit({ id: true, createdAt: true });
export type InsertGameFavorite = z.infer<typeof insertGameFavoriteSchema>;
export type GameFavorite = typeof gameFavoritesTable.$inferSelect;

export const gameSessionsTable = pgTable("game_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  gameSlug: text("game_slug").notNull(),
  players: jsonb("players").$type<SessionPlayerScore[]>().notNull(),
  score: integer("score").notNull().default(0),
  status: text("status").notNull().default("active"),
  winnerName: text("winner_name"),
  won: boolean("won").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const insertGameSessionSchema = createInsertSchema(gameSessionsTable).omit({ id: true, startedAt: true, finishedAt: true });
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessionsTable.$inferSelect;