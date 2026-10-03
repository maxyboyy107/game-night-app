import { and, count, desc, eq, inArray, max, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, catalogStateTable, familyMembersTable, gameFavoritesTable, gameSessionsTable, userProfilesTable, type SessionPlayerScore } from "@workspace/db";
import { createSeedCatalog, normalizeCatalog } from "@workspace/catalog";
import {
  CreateFamilyMemberBody,
  CreateFamilyMemberResponse,
  FinishGameSessionBody,
  FinishGameSessionParams,
  FinishGameSessionResponse,
  GetFamilyMemberHistoryParams,
  GetFamilyMemberHistoryResponse,
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
  UpdateFamilyMemberBody,
  UpdateFamilyMemberParams,
  UpdateFamilyMemberResponse,
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
    players: row.players.map((player) => ({ ...player, familyMemberId: player.familyMemberId ?? null })),
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
  const familyMembers = await db.select().from(familyMembersTable).where(eq(familyMembersTable.ownerUserId, userId)).orderBy(desc(familyMembersTable.createdAt));
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
    familyMembers: familyMembers.map((member) => ({
      id: member.id,
      name: member.name,
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
    })),
  });
}

function validPlayers(players: SessionPlayerScore[], requireScore: boolean): boolean {
  return players.length >= 2 && players.length <= 8
    && players.filter((player) => player.isYou).length === 1
    && players.every((player) => !player.isYou || !player.familyMemberId)
    && new Set(players.map((player) => player.familyMemberId).filter(Boolean)).size === players.filter((player) => player.familyMemberId).length
    && players.every((player) => typeof player.name === "string" && player.name.trim().length > 0 && player.name.trim().length <= 32
      && (!requireScore || Number.isInteger(player.score)));
}

async function loadOwnedFamilyMembers(userId: string, players: SessionPlayerScore[], requireActive: boolean) {
  const ids = [...new Set(players.map((player) => player.familyMemberId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map<string, typeof familyMembersTable.$inferSelect>();
  const rows = await db.select().from(familyMembersTable).where(and(
    eq(familyMembersTable.ownerUserId, userId),
    inArray(familyMembersTable.id, ids),
  ));
  if (rows.length !== ids.length || (requireActive && rows.some((member) => !member.isActive))) return null;
  return new Map(rows.map((member) => [member.id, member]));
}

router.get("/profile", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  res.json(await buildProfile(userId));
});

router.post("/profile/family-members", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = CreateFamilyMemberBody.safeParse(req.body);
  const name = parsed.success ? parsed.data.name.trim() : "";
  if (!parsed.success || !name || name.length > 32) {
    res.status(400).json({ error: "Enter a family member name up to 32 characters." });
    return;
  }
  await ensureProfile(userId);
  const [member] = await db.insert(familyMembersTable).values({ ownerUserId: userId, name }).returning();
  res.status(201).json(CreateFamilyMemberResponse.parse({
    id: member.id,
    name: member.name,
    isActive: member.isActive,
    createdAt: member.createdAt.toISOString(),
  }));
});

router.patch("/profile/family-members/:familyMemberId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = UpdateFamilyMemberParams.safeParse(req.params);
  const parsed = UpdateFamilyMemberBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Provide a valid family member name or active state." });
    return;
  }
  const update: { name?: string; isActive?: boolean; updatedAt: Date } = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) {
    const name = parsed.data.name.trim();
    if (!name || name.length > 32) {
      res.status(400).json({ error: "Enter a family member name up to 32 characters." });
      return;
    }
    update.name = name;
  }
  if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;
  const [member] = await db.update(familyMembersTable).set(update).where(and(
    eq(familyMembersTable.id, params.data.familyMemberId),
    eq(familyMembersTable.ownerUserId, userId),
  )).returning();
  if (!member) {
    res.status(404).json({ error: "Family member not found." });
    return;
  }
  res.json(UpdateFamilyMemberResponse.parse({
    id: member.id,
    name: member.name,
    isActive: member.isActive,
    createdAt: member.createdAt.toISOString(),
  }));
});

router.get("/profile/family-members/:familyMemberId/history", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = GetFamilyMemberHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid family member." });
    return;
  }
  const [member] = await db.select().from(familyMembersTable).where(and(
    eq(familyMembersTable.id, params.data.familyMemberId),
    eq(familyMembersTable.ownerUserId, userId),
  ));
  if (!member) {
    res.status(404).json({ error: "Family member not found." });
    return;
  }
  const sessions = await db.select().from(gameSessionsTable).where(and(
    eq(gameSessionsTable.userId, userId),
    eq(gameSessionsTable.status, "complete"),
    sql`${gameSessionsTable.players} @> ${JSON.stringify([{ familyMemberId: member.id }])}::jsonb`,
  )).orderBy(desc(gameSessionsTable.finishedAt));
  const titles = await gameTitles();
  const memberScores = sessions.map((session) => session.players.find((player) => player.familyMemberId === member.id)?.score ?? 0);
  const wins = sessions.filter((session) => {
    const memberScore = session.players.find((player) => player.familyMemberId === member.id)?.score;
    return memberScore !== undefined && memberScore === Math.max(...session.players.map((player) => player.score));
  }).length;
  res.json(GetFamilyMemberHistoryResponse.parse({
    id: member.id,
    name: member.name,
    isActive: member.isActive,
    stats: {
      gamesPlayed: sessions.length,
      wins,
      highScore: memberScores.length ? Math.max(...memberScores) : 0,
    },
    recentGames: await Promise.all(sessions.slice(0, 30).map((session) => sessionResponse(session, titles))),
  }));
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
  const familyMembers = await loadOwnedFamilyMembers(userId, body.data.players.map((player) => ({ ...player, score: 0 })), true);
  if (!familyMembers) {
    res.status(400).json({ error: "Choose active family profiles that belong to this account, each only once." });
    return;
  }
  const players = body.data.players.map((player) => ({
    ...player,
    name: player.familyMemberId ? familyMembers.get(player.familyMemberId)!.name : player.name.trim(),
    familyMemberId: player.familyMemberId ?? null,
    score: 0,
  }));
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
  if (existing.players.length !== body.data.players.length || body.data.players.some((player, index) => {
    const original = existing.players[index];
    return !original || player.isYou !== original.isYou || (player.familyMemberId ?? null) !== (original.familyMemberId ?? null);
  })) {
    res.status(400).json({ error: "Player identities cannot be changed after a table starts." });
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