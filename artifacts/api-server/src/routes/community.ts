import { and, count, desc, eq, max, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, catalogStateTable, gameFavoritesTable, gameSessionsTable, userProfilesTable, type SessionPlayerScore } from "@workspace/db";
import { createSeedCatalog, normalizeCatalog } from "@workspace/catalog";
import {
  FinishGameSessionBody,
  FinishGameSessionParams,
  FinishGameSessionResponse,
  GetGameLeaderboardParams,
  GetGameLeaderboardResponse,
  GetGameSessionParams,
  GetGameSessionResponse,
  GetProfileResponse,
  SetGameFavoriteBody,
  SetGameFavoriteParams,
  SetGameFavoriteResponse,
  StartGameSessionBody,
  StartGameSessionParams,
  StartGameSessionResponse,
  UpdateProfileAvatarBody,
  UpdateProfileAvatarResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { signedInUserId } from "../lib/adminAuth";

const router: IRouter = Router();
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const PRIVATE_UPLOAD_PATTERN = /^\/objects\/uploads\/[a-f0-9-]{36}$/i;

function requireUser(req: Request, res: Response): string | null {
  const userId = signedInUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign-in required" });
    return null;
  }
  return userId;
}

function fallbackUsername(userId: string): string {
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toLowerCase();
  return `player_${suffix || "guest"}`;
}

async function ensureProfile(userId: string) {
  await db.insert(userProfilesTable).values({ userId, username: fallbackUsername(userId) }).onConflictDoNothing();
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) throw new Error("Unable to load user profile");
  return profile;
}

async function gameTitles(): Promise<Record<string, string>> {
  const [catalog] = await db.select({ data: catalogStateTable.data }).from(catalogStateTable).where(eq(catalogStateTable.id, 1));
  const normalized = normalizeCatalog(catalog?.data || createSeedCatalog());
  return Object.fromEntries(normalized.games.map((game) => [game.slug, game.title]));
}

async function sessionResponse(row: typeof gameSessionsTable.$inferSelect, titles: Record<string, string>) {
  return GetGameSessionResponse.parse({
    id: row.id,
    gameSlug: row.gameSlug,
    gameTitle: titles[row.gameSlug],
    players: row.players,
    score: row.score,
    status: row.status,
    winnerName: row.winnerName,
    won: row.won,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  });
}

async function buildProfile(userId: string) {
  const profile = await ensureProfile(userId);
  const favorites = await db.select({ gameSlug: gameFavoritesTable.gameSlug }).from(gameFavoritesTable).where(eq(gameFavoritesTable.userId, userId));
  const sessions = await db.select().from(gameSessionsTable).where(and(eq(gameSessionsTable.userId, userId), eq(gameSessionsTable.status, "complete"))).orderBy(desc(gameSessionsTable.finishedAt));
  const titles = await gameTitles();
  const mapped = await Promise.all(sessions.map((session) => sessionResponse(session, titles)));
  const highScore = sessions.reduce((best, session) => Math.max(best, session.score), 0);
  const wins = sessions.filter((session) => session.won).length;
  return GetProfileResponse.parse({
    username: profile.username,
    avatarPath: profile.avatarPath,
    favorites: favorites.map((favorite) => favorite.gameSlug),
    stats: { gamesPlayed: sessions.length, wins, highScore },
    recentGames: mapped.slice(0, 30),
    bestGames: [...mapped].sort((a, b) => b.score - a.score || new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 10),
  });
}

function validPlayers(players: SessionPlayerScore[], requireScore: boolean): boolean {
  return players.length >= 2 && players.length <= 8
    && players.filter((player) => player.isYou).length === 1
    && players.every((player) => typeof player.name === "string" && player.name.trim().length > 0 && player.name.trim().length <= 32
      && (!requireScore || Number.isInteger(player.score)));
}

router.get("/profile", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  res.json(await buildProfile(userId));
});

router.put("/profile", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success || !USERNAME_PATTERN.test(parsed.data.username)) {
    res.status(400).json({ error: "Use 3–20 letters, numbers, or underscores." });
    return;
  }
  const username = parsed.data.username.trim();
  const [existing] = await db.select({ userId: userProfilesTable.userId }).from(userProfilesTable).where(sql`lower(${userProfilesTable.username}) = lower(${username})`).limit(1);
  if (existing && existing.userId !== userId) {
    res.status(409).json({ error: "That username is already in use." });
    return;
  }
  await ensureProfile(userId);
  await db.update(userProfilesTable).set({ username, updatedAt: new Date() }).where(eq(userProfilesTable.userId, userId));
  res.json(UpdateProfileResponse.parse(await buildProfile(userId)));
});

router.put("/profile/avatar", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = UpdateProfileAvatarBody.safeParse(req.body);
  if (!parsed.success || !PRIVATE_UPLOAD_PATTERN.test(parsed.data.avatarPath)) {
    res.status(400).json({ error: "Upload a profile image first." });
    return;
  }
  await ensureProfile(userId);
  await db.update(userProfilesTable).set({ avatarPath: parsed.data.avatarPath, updatedAt: new Date() }).where(eq(userProfilesTable.userId, userId));
  res.json(UpdateProfileAvatarResponse.parse(await buildProfile(userId)));
});

router.put("/profile/favorites/:gameSlug", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = SetGameFavoriteParams.safeParse(req.params);
  const body = SetGameFavoriteBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid favorite request." });
    return;
  }
  const titles = await gameTitles();
  if (!titles[params.data.gameSlug]) {
    res.status(404).json({ error: "Game not found." });
    return;
  }
  if (body.data.favorited) {
    await db.insert(gameFavoritesTable).values({ userId, gameSlug: params.data.gameSlug }).onConflictDoNothing();
  } else {
    await db.delete(gameFavoritesTable).where(and(eq(gameFavoritesTable.userId, userId), eq(gameFavoritesTable.gameSlug, params.data.gameSlug)));
  }
  res.json(SetGameFavoriteResponse.parse({ gameSlug: params.data.gameSlug, favorited: body.data.favorited }));
});

router.post("/games/:gameSlug/sessions", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = StartGameSessionParams.safeParse(req.params);
  const body = StartGameSessionBody.safeParse(req.body);
  if (!params.success || !body.success || !validPlayers(body.data.players.map((player) => ({ ...player, score: 0 })), false)) {
    res.status(400).json({ error: "Add 2–8 players, including yourself exactly once." });
    return;
  }
  const titles = await gameTitles();
  if (!titles[params.data.gameSlug]) {
    res.status(404).json({ error: "Game not found." });
    return;
  }
  await ensureProfile(userId);
  const players = body.data.players.map((player) => ({ ...player, name: player.name.trim(), score: 0 }));
  const [session] = await db.insert(gameSessionsTable).values({ userId, gameSlug: params.data.gameSlug, players, status: "active", score: 0, won: false }).returning();
  res.status(201).json(StartGameSessionResponse.parse(await sessionResponse(session, titles)));
});

router.get("/games/sessions/:sessionId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = GetGameSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  const [session] = await db.select().from(gameSessionsTable).where(and(eq(gameSessionsTable.id, params.data.sessionId), eq(gameSessionsTable.userId, userId)));
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  res.json(GetGameSessionResponse.parse(await sessionResponse(session, await gameTitles())));
});

router.patch("/games/sessions/:sessionId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = FinishGameSessionParams.safeParse(req.params);
  const body = FinishGameSessionBody.safeParse(req.body);
  if (!params.success || !body.success || !validPlayers(body.data.players, true)) {
    res.status(400).json({ error: "Final scores must include 2–8 players and your player exactly once." });
    return;
  }
  const [existing] = await db.select().from(gameSessionsTable).where(and(eq(gameSessionsTable.id, params.data.sessionId), eq(gameSessionsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  if (existing.status === "complete") {
    res.json(FinishGameSessionResponse.parse(await sessionResponse(existing, await gameTitles())));
    return;
  }
  const players = body.data.players.map((player) => ({ ...player, name: player.name.trim() }));
  const topScore = Math.max(...players.map((player) => player.score));
  const winners = players.filter((player) => player.score === topScore);
  const you = players.find((player) => player.isYou)!;
  const [session] = await db.update(gameSessionsTable).set({
    players,
    score: you.score,
    status: "complete",
    winnerName: winners.map((winner) => winner.name).join(" / "),
    won: winners.some((winner) => winner.isYou),
    finishedAt: existing.finishedAt || new Date(),
  }).where(eq(gameSessionsTable.id, existing.id)).returning();
  res.json(FinishGameSessionResponse.parse(await sessionResponse(session, await gameTitles())));
});

router.get("/games/:gameSlug/leaderboard", async (req, res): Promise<void> => {
  const params = GetGameLeaderboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid game." });
    return;
  }
  const titles = await gameTitles();
  if (!titles[params.data.gameSlug]) {
    res.status(404).json({ error: "Game not found." });
    return;
  }
  const rows = await db.select({
    username: userProfilesTable.username,
    avatarPath: userProfilesTable.avatarPath,
    score: max(gameSessionsTable.score),
    gamesPlayed: count(gameSessionsTable.id),
    wins: sql<number>`sum(case when ${gameSessionsTable.won} then 1 else 0 end)`,
  }).from(gameSessionsTable).innerJoin(userProfilesTable, eq(gameSessionsTable.userId, userProfilesTable.userId))
    .where(and(eq(gameSessionsTable.gameSlug, params.data.gameSlug), eq(gameSessionsTable.status, "complete")))
    .groupBy(gameSessionsTable.userId, userProfilesTable.username, userProfilesTable.avatarPath)
    .orderBy(desc(max(gameSessionsTable.score)))
    .limit(20);
  res.json(GetGameLeaderboardResponse.parse({
    gameSlug: params.data.gameSlug,
    entries: rows.map((row) => ({ username: row.username, avatarPath: row.avatarPath, score: Number(row.score || 0), gamesPlayed: row.gamesPlayed, wins: Number(row.wins || 0) })),
  }));
});

export default router;