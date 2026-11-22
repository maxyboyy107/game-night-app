import { createHmac, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  familyMembersTable,
  gameFavoritesTable,
  gameNightGamesTable,
  gameNightLocalGamesTable,
  gameNightMembershipsTable,
  gameNightProfilesTable,
  gameNightsTable,
  gameSessionsTable,
  userProfilesTable,
  type SessionPlayerScore,
  type GameNightVariationNode,
} from "@workspace/db";
import type { Game, ScorekeeperMode } from "@workspace/catalog";
import {
  CreateHistoricalGameBody,
  CreateHistoricalGameResponse,
  CreateFamilyMemberBody,
  CreateFamilyMemberResponse,
  DeleteGameSessionParams,
  DeleteGameSessionResponse,
  ExportProfileBackupResponse,
  GetProfileGamesResponse,
  GetGameLeaderboardParams,
  GetGameLeaderboardResponse,
  FinishGameSessionBody,
  FinishGameSessionParams,
  FinishGameSessionResponse,
  GetFamilyMemberHistoryParams,
  GetFamilyMemberHistoryResponse,
  GetFamilyGameLeaderboardParams,
  GetFamilyGameLeaderboardResponse,
  GetGameSessionParams,
  GetGameSessionResponse,
  GetGlobalGameLeaderboardParams,
  GetGlobalGameLeaderboardResponse,
  GetProfileResponse,
  ProfileBackup,
  RestoreProfileBackupBody,
  RestoreProfileBackupResponse,
  SetGameFavoriteBody,
  SetGameFavoriteParams,
  SetGameFavoriteResponse,
  StartGameSessionBody,
  StartGameSessionParams,
  StartGameSessionResponse,
  UpdateGameSessionBody,
  UpdateGameSessionParams,
  UpdateGameSessionResponse,
  UpdateFamilyMemberBody,
  UpdateFamilyMemberParams,
  UpdateFamilyMemberResponse,
  UpdateProfileAvatarBody,
  UpdateProfileAvatarResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { signedInUserId } from "../lib/adminAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { loadCatalogState } from "../lib/catalogPersistence";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
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

function asDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function profileBackupKey(userId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for private profile backups.");
  const digest = createHmac("sha256", secret).update(userId).digest("hex");
  return `profiles/${digest}`;
}

async function readProfileBackup(userId: string): Promise<ProfileBackup | null> {
  const saved = await objectStorage.readJsonBackup<unknown>(profileBackupKey(userId));
  if (!saved) return null;
  const parsed = RestoreProfileBackupBody.safeParse(saved);
  if (!parsed.success || parsed.data.accountId !== userId) throw new Error("The private profile backup is invalid.");
  return parsed.data;
}

async function restoreProfileBackupData(userId: string, backup: ProfileBackup): Promise<void> {
  await db.insert(userProfilesTable).values({
    userId,
    username: fallbackUsername(userId),
    avatarPath: backup.avatarPath,
  }).onConflictDoNothing();

  const familyIdMap = new Map<string, string>();
  for (const member of backup.familyMembers) {
    const [existing] = await db.select({ ownerUserId: familyMembersTable.ownerUserId })
      .from(familyMembersTable).where(eq(familyMembersTable.id, member.id));
    const familyId = !existing || existing.ownerUserId === userId ? member.id : randomUUID();
    familyIdMap.set(member.id, familyId);
    await db.insert(familyMembersTable).values({
      id: familyId,
      ownerUserId: userId,
      name: member.name,
      isActive: member.isActive,
      createdAt: asDate(member.createdAt),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: familyMembersTable.id,
      set: { name: member.name, isActive: member.isActive, updatedAt: new Date() },
    });
  }
  for (const gameSlug of backup.favorites) {
    await db.insert(gameFavoritesTable).values({ userId, gameSlug }).onConflictDoNothing();
  }
  for (const game of backup.games) {
    const players = game.players.map((player) => ({
      ...player,
      familyMemberId: player.familyMemberId ? familyIdMap.get(player.familyMemberId) ?? null : null,
    }));
    await db.insert(gameSessionsTable).values({
      id: game.id,
      userId,
      gameSlug: game.gameSlug,
      gameNightId: game.gameNightId ?? null,
      localGameId: game.localGameId ?? null,
      gameTitle: game.gameTitle ?? null,
      scorekeeperModeId: game.modeId,
      scorekeeperModeName: game.modeName,
      scorekeeperStrategy: game.strategy,
      scoreDirection: game.scoreDirection ?? "highest",
      scorekeeperTarget: game.scorekeeperTarget ?? null,
      variation: game.variation,
      note: game.note,
      source: game.source,
      players,
      score: game.score ?? 0,
      status: game.status,
      winnerName: game.winnerName,
      won: game.won,
      startedAt: asDate(game.startedAt),
      finishedAt: game.finishedAt ? asDate(game.finishedAt) : null,
    }).onConflictDoNothing();
  }
}

async function saveProfileBackup(userId: string): Promise<void> {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) return;
  const favorites = await db.select({ gameSlug: gameFavoritesTable.gameSlug })
    .from(gameFavoritesTable).where(eq(gameFavoritesTable.userId, userId));
  const familyMembers = await db.select().from(familyMembersTable)
    .where(eq(familyMembersTable.ownerUserId, userId)).orderBy(desc(familyMembersTable.createdAt));
  const sessions = await db.select().from(gameSessionsTable)
    .where(eq(gameSessionsTable.userId, userId)).orderBy(desc(gameSessionsTable.startedAt));
  const titles = await gameTitles();
  const backup = ExportProfileBackupResponse.parse({
    schemaVersion: 1,
    accountId: userId,
    createdAt: new Date().toISOString(),
    username: profile.username,
    avatarPath: profile.avatarPath,
    favorites: favorites.map((favorite) => favorite.gameSlug),
    familyMembers: familyMembers.map((member) => ({
      id: member.id,
      name: member.name,
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
    })),
    games: await Promise.all(sessions.map((session) => sessionResponse(session, titles))),
  });
  await objectStorage.writeJsonBackup(profileBackupKey(userId), backup);
}

async function persistProfileBackupSafely(userId: string): Promise<void> {
  try {
    await saveProfileBackup(userId);
  } catch (error) {
    console.error("Unable to refresh the private profile backup; PostgreSQL remains the primary store.", error);
  }
}

async function profileBackupHasMissingRecords(userId: string, backup: ProfileBackup): Promise<boolean> {
  const [members, favorites, sessions] = await Promise.all([
    db.select({ id: familyMembersTable.id }).from(familyMembersTable).where(eq(familyMembersTable.ownerUserId, userId)),
    db.select({ gameSlug: gameFavoritesTable.gameSlug }).from(gameFavoritesTable).where(eq(gameFavoritesTable.userId, userId)),
    db.select({ id: gameSessionsTable.id }).from(gameSessionsTable).where(eq(gameSessionsTable.userId, userId)),
  ]);
  const memberIds = new Set(members.map((member) => member.id));
  const favoriteSlugs = new Set(favorites.map((favorite) => favorite.gameSlug));
  const sessionIds = new Set(sessions.map((session) => session.id));
  return backup.familyMembers.some((member) => !memberIds.has(member.id))
    || backup.favorites.some((slug) => !favoriteSlugs.has(slug))
    || backup.games.some((game) => !sessionIds.has(game.id));
}

async function ensureProfile(userId: string) {
  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  try {
    const backup = await readProfileBackup(userId);
    if (backup && (!existing || await profileBackupHasMissingRecords(userId, backup))) {
      await restoreProfileBackupData(userId, backup);
    }
  } catch (error) {
    console.error("Unable to restore the private profile backup.", error);
  }
  if (existing) return existing;
  await db.insert(userProfilesTable).values({ userId, username: fallbackUsername(userId) }).onConflictDoNothing();
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) throw new Error("Unable to load user profile");
  return profile;
}

async function gameTitles(): Promise<Record<string, string>> {
  const catalog = await loadCatalogState();
  return Object.fromEntries(catalog.games.map((game) => [game.slug, game.title]));
}

async function gameAndMode(gameSlug: string, modeId: string, gameNightId?: string): Promise<{ game: Game; mode: ScorekeeperMode; localGameId?: string } | null> {
  if (gameNightId) {
    const [localGame] = await db.select().from(gameNightLocalGamesTable).where(and(
      eq(gameNightLocalGamesTable.gameNightId, gameNightId),
      eq(gameNightLocalGamesTable.slug, gameSlug),
    ));
    const localMode = localGame?.scorekeeperModes.find((candidate) => candidate.id === modeId);
    if (localGame && localMode) {
      return {
        game: {
          slug: localGame.slug,
          title: localGame.title,
          alternateNames: [],
          categorySlugs: [],
          eyebrow: "Game Night local game",
          description: localGame.description,
          players: `${localGame.minPlayers}–${localGame.maxPlayers} players`,
          setup: "",
          age: "",
          duration: "",
          equipment: [],
          objective: localGame.description,
          rules: localGame.rules.split("\n").filter(Boolean),
          accent: "#f9be4b",
          icon: "★",
          scorekeeperModes: localGame.scorekeeperModes,
          variations: localGame.variations,
        },
        mode: localMode,
        localGameId: localGame.id,
      };
    }
  }
  const catalog = await loadCatalogState();
  const game = catalog.games.find((candidate) => candidate.slug === gameSlug);
  const mode = game?.scorekeeperModes?.find((candidate) => candidate.id === modeId);
  if (game && mode) return { game, mode };
  return null;
}

function flattenVariationPaths(nodes: GameNightVariationNode[], prefix = ""): string[] {
  return nodes.flatMap((node) => {
    const path = prefix ? `${prefix} / ${node.name}` : node.name;
    return [path, ...flattenVariationPaths(node.children || [], path)];
  });
}

async function validateGameNightGame(gameNightId: string, gameSlug: string, localGameId?: string): Promise<boolean> {
  if (localGameId) return true;
  const [selection] = await db.select({ id: gameNightGamesTable.id }).from(gameNightGamesTable).where(and(
    eq(gameNightGamesTable.gameNightId, gameNightId),
    eq(gameNightGamesTable.gameSlug, gameSlug),
  ));
  return Boolean(selection);
}

async function isAllowedVariation(gameNightId: string | null | undefined, gameSlug: string, variation: string | null | undefined, available: string[] = []): Promise<boolean> {
  if (!variation) return true;
  if (available.includes(variation)) return true;
  if (!gameNightId) return false;
  const [selection] = await db.select().from(gameNightGamesTable).where(and(
    eq(gameNightGamesTable.gameNightId, gameNightId),
    eq(gameNightGamesTable.gameSlug, gameSlug),
  ));
  return Boolean(selection && flattenVariationPaths(selection.variationTree).includes(variation));
}

async function sessionResponse(row: typeof gameSessionsTable.$inferSelect, titles: Record<string, string>) {
  const strategy: ScorekeeperMode["strategy"] = row.scorekeeperStrategy === "winner"
    ? "winner"
    : row.scorekeeperStrategy === "first_to"
      ? "first_to"
      : "points";
  const scoreDirection = strategy === "points" ? (row.scoreDirection === "lowest" ? "lowest" : "highest") : null;
  const numericScores = row.players.map((player) => player.score).filter((score): score is number => typeof score === "number");
  const winningScore = scoreDirection === "lowest" ? Math.min(...numericScores) : Math.max(...numericScores);
  const players = row.players.map((player) => ({
    ...player,
    score: strategy === "winner" ? null : player.score ?? 0,
    isWinner: typeof player.isWinner === "boolean" ? player.isWinner : strategy === "points" && player.score === winningScore,
    familyMemberId: player.familyMemberId ?? null,
    gameNightProfileId: player.gameNightProfileId ?? null,
  }));
  const winnerName = row.winnerName || players.filter((player) => player.isWinner).map((player) => player.name).join(" / ") || null;
  const playedAt = row.finishedAt ?? row.startedAt;
  return GetGameSessionResponse.parse({
    id: row.id,
    gameSlug: row.gameSlug,
    gameTitle: row.gameTitle || titles[row.gameSlug] || row.gameSlug,
    players,
    score: strategy === "winner" ? null : row.score,
    status: row.status,
    winnerName,
    won: row.won,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    modeId: row.scorekeeperModeId,
    modeName: row.scorekeeperModeName,
    strategy,
    scoreDirection,
    scorekeeperTarget: row.scorekeeperTarget,
    gameNightId: row.gameNightId,
    localGameId: row.localGameId,
    variation: row.variation,
    note: row.note,
    source: row.source === "historical" ? "historical" : "live",
    playedAt: playedAt.toISOString(),
  });
}

async function buildProfile(userId: string) {
  const profile = await ensureProfile(userId);
  const favorites = await db.select({ gameSlug: gameFavoritesTable.gameSlug }).from(gameFavoritesTable).where(eq(gameFavoritesTable.userId, userId));
  const familyMembers = await db.select().from(familyMembersTable).where(eq(familyMembersTable.ownerUserId, userId)).orderBy(desc(familyMembersTable.createdAt));
  const sessions = await db.select().from(gameSessionsTable).where(and(eq(gameSessionsTable.userId, userId), eq(gameSessionsTable.status, "complete"))).orderBy(desc(gameSessionsTable.finishedAt));
  const titles = await gameTitles();
  const mapped = await Promise.all(sessions.map((session) => sessionResponse(session, titles)));
  const highScore = sessions.reduce((best, session) => session.scorekeeperStrategy === "winner" ? best : Math.max(best, session.score), 0);
  const wins = sessions.filter((session) => session.won).length;
  const bestGames = [...mapped].sort((a, b) => {
    if (a.strategy === "winner" || b.strategy === "winner") return Number(b.won) - Number(a.won) || new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
    if (a.scoreDirection === "lowest" && b.scoreDirection === "lowest") return (a.score ?? 0) - (b.score ?? 0);
    return (b.score ?? 0) - (a.score ?? 0);
  });
  return GetProfileResponse.parse({
    username: profile.username,
    avatarPath: profile.avatarPath,
    favorites: favorites.map((favorite) => favorite.gameSlug),
    stats: { gamesPlayed: sessions.length, wins, highScore },
    recentGames: mapped.slice(0, 30),
    bestGames: bestGames.slice(0, 10),
    familyMembers: familyMembers.map((member) => ({
      id: member.id,
      name: member.name,
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
    })),
  });
}

function validPlayers(players: SessionPlayerScore[], options: { requireYou: boolean; strategy: ScorekeeperMode["strategy"]; requireResults: boolean }): boolean {
  const youCount = players.filter((player) => player.isYou).length;
  const hasValidScores = players.every((player) => options.strategy !== "winner"
    ? (options.requireResults ? Number.isInteger(player.score) : player.score === null || Number.isInteger(player.score))
    : player.score === null);
  const hasWinner = players.some((player) => player.isWinner);
  return players.length >= 2 && players.length <= 8
    && (options.requireYou ? youCount === 1 : youCount <= 1)
    && players.every((player) => !player.isYou || (!player.familyMemberId && !player.gameNightProfileId))
    && new Set(players.map((player) => player.familyMemberId).filter(Boolean)).size === players.filter((player) => player.familyMemberId).length
    && new Set(players.map((player) => player.gameNightProfileId).filter(Boolean)).size === players.filter((player) => player.gameNightProfileId).length
    && players.every((player) => typeof player.name === "string" && player.name.trim().length > 0 && player.name.trim().length <= 32
      && (player.isWinner === undefined || typeof player.isWinner === "boolean"))
    && hasValidScores
    && (!options.requireResults || options.strategy === "points" || hasWinner);
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

async function loadGameNightProfiles(gameNightId: string, players: SessionPlayerScore[], requireActive: boolean) {
  const ids = [...new Set(players.map((player) => player.gameNightProfileId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map<string, typeof gameNightProfilesTable.$inferSelect>();
  const rows = await db.select().from(gameNightProfilesTable).where(and(
    eq(gameNightProfilesTable.gameNightId, gameNightId),
    inArray(gameNightProfilesTable.id, ids),
  ));
  if (rows.length !== ids.length || (requireActive && rows.some((profile) => !profile.isActive))) return null;
  return new Map(rows.map((profile) => [profile.id, profile]));
}

function completedResults(players: SessionPlayerScore[], mode: ScorekeeperMode) {
  const normalized = players.map((player) => ({
    ...player,
    name: player.name.trim(),
    familyMemberId: player.familyMemberId ?? null,
    gameNightProfileId: player.gameNightProfileId ?? null,
    score: mode.strategy === "winner" ? null : player.score,
    isWinner: mode.strategy === "points" ? false : Boolean(player.isWinner),
  }));
  if (mode.strategy === "points") {
    const scores = normalized.map((player) => player.score ?? 0);
    const winningScore = mode.direction === "lowest" ? Math.min(...scores) : Math.max(...scores);
    normalized.forEach((player) => { player.isWinner = player.score === winningScore; });
  }
  const winners = normalized.filter((player) => player.isWinner);
  const you = normalized.find((player) => player.isYou);
  return {
    players: normalized,
    score: you?.score ?? 0,
    winnerName: winners.map((winner) => winner.name).join(" / ") || null,
    won: Boolean(you?.isWinner),
  };
}

router.get("/profile", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  res.json(await buildProfile(userId));
});

router.get("/profile/games", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const sessions = await db.select().from(gameSessionsTable)
    .where(and(eq(gameSessionsTable.userId, userId), eq(gameSessionsTable.status, "complete")))
    .orderBy(desc(gameSessionsTable.finishedAt));
  const titles = await gameTitles();
  res.json(GetProfileGamesResponse.parse({ games: await Promise.all(sessions.map((session) => sessionResponse(session, titles))) }));
});

router.get("/profile/backup", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const profile = await buildProfile(userId);
  const sessions = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.userId, userId)).orderBy(desc(gameSessionsTable.startedAt));
  const titles = await gameTitles();
  await persistProfileBackupSafely(userId);
  res.setHeader("Content-Disposition", 'attachment; filename="games-io-profile-backup.json"');
  res.json(ExportProfileBackupResponse.parse({
    schemaVersion: 1,
    accountId: userId,
    createdAt: new Date().toISOString(),
    username: profile.username,
    avatarPath: profile.avatarPath,
    favorites: profile.favorites,
    familyMembers: profile.familyMembers,
    games: await Promise.all(sessions.map((session) => sessionResponse(session, titles))),
  }));
});

router.post("/profile/backup", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = RestoreProfileBackupBody.safeParse(req.body);
  if (!parsed.success || parsed.data.accountId !== userId) {
    res.status(400).json({ error: "Choose a valid backup created for this account." });
    return;
  }
  const backup: ProfileBackup = parsed.data;
  await restoreProfileBackupData(userId, backup);
  await persistProfileBackupSafely(userId);
  res.json(RestoreProfileBackupResponse.parse(await buildProfile(userId)));
});

router.post("/profile/games", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const body = CreateHistoricalGameBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Add a game, played date, at least two players, and valid results." });
    return;
  }
  if (body.data.gameNightId) {
    const [membership] = await db.select().from(gameNightMembershipsTable).where(and(
      eq(gameNightMembershipsTable.gameNightId, body.data.gameNightId),
      eq(gameNightMembershipsTable.userId, userId),
      eq(gameNightMembershipsTable.status, "active"),
    ));
    if (!membership) {
      res.status(403).json({ error: "Join this Game Night before adding a result to its timeline." });
      return;
    }
  }
  const configured = await gameAndMode(body.data.gameSlug, body.data.modeId, body.data.gameNightId ?? undefined);
  if (!configured) {
    res.status(404).json({ error: "Game or scorekeeper mode not found." });
    return;
  }
  if (body.data.gameNightId && !await validateGameNightGame(body.data.gameNightId, configured.game.slug, configured.localGameId)) {
    res.status(400).json({ error: "The host has not added this game to the Game Night yet." });
    return;
  }
  const { game, mode } = configured;
  const proposedPlayers: SessionPlayerScore[] = body.data.players.map((player) => ({
    name: player.name,
    score: player.score,
    isYou: player.isYou,
    familyMemberId: player.familyMemberId,
    gameNightProfileId: player.gameNightProfileId,
    isWinner: player.isWinner,
  }));
  if (!validPlayers(proposedPlayers, { requireYou: false, strategy: mode.strategy, requireResults: true })) {
    res.status(400).json({ error: mode.strategy === "winner"
      ? "Choose at least one winner and include 2–8 players."
      : "Enter a whole-number score for each of the 2–8 players." });
    return;
  }
  if (!await isAllowedVariation(body.data.gameNightId, game.slug, body.data.variation, game.variations)) {
    res.status(400).json({ error: "Choose a variation listed for this game." });
    return;
  }
  await ensureProfile(userId);
  const familyMembers = await loadOwnedFamilyMembers(userId, proposedPlayers, false);
  if (!familyMembers) {
    res.status(400).json({ error: "Choose family profiles that belong to this account." });
    return;
  }
  const gameNightProfiles = body.data.gameNightId
    ? await loadGameNightProfiles(body.data.gameNightId, proposedPlayers, false)
    : new Map<string, typeof gameNightProfilesTable.$inferSelect>();
  if (!gameNightProfiles || proposedPlayers.some((player) => player.gameNightProfileId && !body.data.gameNightId)) {
    res.status(400).json({ error: "Choose family profiles that belong to this Game Night." });
    return;
  }
  if (mode.strategy === "first_to") {
    const target = mode.targetScore ?? 10;
    const winners = proposedPlayers.filter((player) => player.isWinner);
    if (winners.length !== 1 || (winners[0]?.score ?? 0) < target) {
      res.status(400).json({ error: `Mark the single player who first reached ${target} points.` });
      return;
    }
  }
  const players = proposedPlayers.map((player) => ({
    ...player,
    name: player.gameNightProfileId
      ? gameNightProfiles.get(player.gameNightProfileId)!.name
      : player.familyMemberId
        ? familyMembers.get(player.familyMemberId)!.name
        : player.name.trim(),
    familyMemberId: player.familyMemberId ?? null,
    gameNightProfileId: player.gameNightProfileId ?? null,
  }));
  const results = completedResults(players, mode);
  const playedAt = asDate(body.data.playedAt);
  const [session] = await db.insert(gameSessionsTable).values({
    userId,
    gameSlug: game.slug,
    gameNightId: body.data.gameNightId ?? null,
    localGameId: configured.localGameId ?? null,
    gameTitle: game.title,
    scorekeeperModeId: mode.id,
    scorekeeperModeName: mode.name,
    scorekeeperStrategy: mode.strategy,
    scoreDirection: mode.strategy === "points" ? mode.direction ?? "highest" : "highest",
    scorekeeperTarget: mode.strategy === "first_to" ? mode.targetScore ?? 10 : null,
    variation: body.data.variation ?? null,
    note: body.data.note?.trim() || null,
    source: "historical",
    players: results.players,
    score: results.score,
    status: "complete",
    winnerName: results.winnerName,
    won: results.won,
    startedAt: playedAt,
    finishedAt: playedAt,
  }).returning();
  await persistProfileBackupSafely(userId);
  res.status(201).json(CreateHistoricalGameResponse.parse(await sessionResponse(session, { [game.slug]: game.title })));
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
  await persistProfileBackupSafely(userId);
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
  await persistProfileBackupSafely(userId);
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
  const memberPlayers = sessions.map((session) => ({
    session,
    player: session.players.find((player) => player.familyMemberId === member.id),
  })).filter((entry) => entry.player);
  const memberScores = memberPlayers
    .filter(({ session }) => session.scorekeeperStrategy !== "winner")
    .map(({ player }) => player?.score)
    .filter((score): score is number => typeof score === "number");
  const wins = memberPlayers.filter(({ session, player }) => {
    if (typeof player?.isWinner === "boolean") return player.isWinner;
    if (!player || session.scorekeeperStrategy === "winner" || typeof player.score !== "number") return false;
    const scores = session.players.map((entry) => entry.score).filter((score): score is number => typeof score === "number");
    return player.score === (session.scoreDirection === "lowest" ? Math.min(...scores) : Math.max(...scores));
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
  await persistProfileBackupSafely(userId);
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
  await persistProfileBackupSafely(userId);
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
  await persistProfileBackupSafely(userId);
  res.json(SetGameFavoriteResponse.parse({ gameSlug: params.data.gameSlug, favorited: body.data.favorited }));
});

router.post("/games/:gameSlug/sessions", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = StartGameSessionParams.safeParse(req.params);
  const body = StartGameSessionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Choose a scorekeeper mode and add 2–8 players." });
    return;
  }
  const [membership] = await db.select().from(gameNightMembershipsTable).where(and(
    eq(gameNightMembershipsTable.gameNightId, body.data.gameNightId),
    eq(gameNightMembershipsTable.userId, userId),
    eq(gameNightMembershipsTable.status, "active"),
  ));
  if (!membership) {
    res.status(403).json({ error: "Join a Game Night before starting a scorekeeper." });
    return;
  }
  const configured = await gameAndMode(params.data.gameSlug, body.data.modeId, body.data.gameNightId);
  if (!configured) {
    res.status(404).json({ error: "Game not found." });
    return;
  }
  if (!await validateGameNightGame(body.data.gameNightId, configured.game.slug, configured.localGameId)) {
    res.status(403).json({ error: "The host has not added this game to the Game Night yet." });
    return;
  }
  const { game, mode } = configured;
  const proposedPlayers: SessionPlayerScore[] = body.data.players.map((player) => ({
    ...player,
    score: mode.strategy === "winner" ? null : 0,
    isWinner: false,
  }));
  if (!validPlayers(proposedPlayers, { requireYou: true, strategy: mode.strategy, requireResults: false })) {
    res.status(400).json({ error: "Add 2–8 players, including yourself exactly once." });
    return;
  }
  if (!await isAllowedVariation(body.data.gameNightId, game.slug, body.data.variation, game.variations)) {
    res.status(400).json({ error: "Choose a variation listed for this game." });
    return;
  }
  await ensureProfile(userId);
  const familyMembers = await loadOwnedFamilyMembers(userId, proposedPlayers, true);
  if (!familyMembers) {
    res.status(400).json({ error: "Choose active family profiles that belong to this account, each only once." });
    return;
  }
  const gameNightProfiles = await loadGameNightProfiles(body.data.gameNightId, proposedPlayers, true);
  if (!gameNightProfiles) {
    res.status(400).json({ error: "Choose active family profiles from this Game Night, each only once." });
    return;
  }
  if (proposedPlayers.some((player) => player.familyMemberId && player.gameNightProfileId)) {
    res.status(400).json({ error: "A player can use one family profile at a time." });
    return;
  }
  const players = proposedPlayers.map((player) => ({
    ...player,
    name: player.gameNightProfileId
      ? gameNightProfiles.get(player.gameNightProfileId)!.name
      : player.familyMemberId
        ? familyMembers.get(player.familyMemberId)!.name
        : player.name.trim(),
    familyMemberId: player.familyMemberId ?? null,
    gameNightProfileId: player.gameNightProfileId ?? null,
    isWinner: false,
  }));
  const [session] = await db.insert(gameSessionsTable).values({
    userId,
    gameSlug: params.data.gameSlug,
    gameNightId: body.data.gameNightId,
    localGameId: configured.localGameId ?? null,
    gameTitle: game.title,
    scorekeeperModeId: mode.id,
    scorekeeperModeName: mode.name,
    scorekeeperStrategy: mode.strategy,
    scoreDirection: mode.strategy === "points" ? mode.direction ?? "highest" : "highest",
    scorekeeperTarget: mode.strategy === "first_to" ? mode.targetScore ?? 10 : null,
    variation: body.data.variation ?? null,
    note: body.data.note?.trim() || null,
    source: "live",
    players,
    status: "active",
    score: 0,
    won: false,
  }).returning();
  await persistProfileBackupSafely(userId);
  res.status(201).json(StartGameSessionResponse.parse(await sessionResponse(session, { [game.slug]: game.title })));
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
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Provide valid results for this game." });
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
  const strategy: ScorekeeperMode["strategy"] = existing.scorekeeperStrategy === "winner"
    ? "winner"
    : existing.scorekeeperStrategy === "first_to"
      ? "first_to"
      : "points";
  if (!validPlayers(body.data.players, { requireYou: true, strategy, requireResults: true })) {
    res.status(400).json({ error: strategy === "winner"
      ? "Choose at least one winner and include your player exactly once."
      : "Final scores must be whole numbers for 2–8 players, including yourself exactly once." });
    return;
  }
  if (existing.players.length !== body.data.players.length || body.data.players.some((player, index) => {
    const original = existing.players[index];
    return !original || player.isYou !== original.isYou
      || (player.familyMemberId ?? null) !== (original.familyMemberId ?? null)
      || (player.gameNightProfileId ?? null) !== (original.gameNightProfileId ?? null);
  })) {
    res.status(400).json({ error: "Player identities cannot be changed after a table starts." });
    return;
  }
  const mode: ScorekeeperMode = {
    id: existing.scorekeeperModeId,
    name: existing.scorekeeperModeName,
    strategy,
    ...(strategy === "points" ? { direction: existing.scoreDirection === "lowest" ? "lowest" : "highest" } : {}),
    ...(strategy === "first_to" ? { targetScore: existing.scorekeeperTarget ?? 10 } : {}),
  };
  if (strategy === "first_to") {
    const winners = body.data.players.filter((player) => player.isWinner);
    if (winners.length !== 1 || (winners[0]?.score ?? 0) < (existing.scorekeeperTarget ?? 10)) {
      res.status(400).json({ error: `Mark the single player who first reached ${existing.scorekeeperTarget ?? 10} points.` });
      return;
    }
  }
  const results = completedResults(body.data.players, mode);
  const [session] = await db.update(gameSessionsTable).set({
    players: results.players,
    score: results.score,
    status: "complete",
    winnerName: results.winnerName,
    won: results.won,
    note: body.data.note === undefined ? existing.note : body.data.note?.trim() || null,
    finishedAt: existing.finishedAt || new Date(),
  }).where(eq(gameSessionsTable.id, existing.id)).returning();
  await persistProfileBackupSafely(userId);
  res.json(FinishGameSessionResponse.parse(await sessionResponse(session, await gameTitles())));
});

router.put("/games/sessions/:sessionId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = UpdateGameSessionParams.safeParse(req.params);
  const body = UpdateGameSessionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Provide a valid game, date, players, and results." });
    return;
  }
  const [existing] = await db.select().from(gameSessionsTable).where(and(
    eq(gameSessionsTable.id, params.data.sessionId),
    eq(gameSessionsTable.userId, userId),
  ));
  if (!existing || existing.status !== "complete") {
    res.status(404).json({ error: "Completed game not found." });
    return;
  }
  const configured = await gameAndMode(body.data.gameSlug, body.data.modeId, existing.gameNightId ?? undefined);
  if (!configured) {
    res.status(404).json({ error: "Game or scorekeeper mode not found." });
    return;
  }
  if (existing.gameNightId && !await validateGameNightGame(existing.gameNightId, configured.game.slug, configured.localGameId)) {
    res.status(400).json({ error: "The host has not added this game to the Game Night yet." });
    return;
  }
  const { game, mode } = configured;
  const proposedPlayers: SessionPlayerScore[] = body.data.players.map((player) => ({
    name: player.name,
    score: player.score,
    isYou: player.isYou,
    familyMemberId: player.familyMemberId,
    gameNightProfileId: player.gameNightProfileId,
    isWinner: player.isWinner,
  }));
  if (!validPlayers(proposedPlayers, { requireYou: false, strategy: mode.strategy, requireResults: true })) {
    res.status(400).json({ error: mode.strategy === "winner"
      ? "Choose at least one winner and include 2–8 players."
      : "Enter a whole-number score for each of the 2–8 players." });
    return;
  }
  if (!await isAllowedVariation(existing.gameNightId, game.slug, body.data.variation, game.variations)) {
    res.status(400).json({ error: "Choose a variation listed for this game." });
    return;
  }
  const familyMembers = await loadOwnedFamilyMembers(userId, proposedPlayers, false);
  if (!familyMembers) {
    res.status(400).json({ error: "Choose family profiles that belong to this account." });
    return;
  }
  const gameNightProfiles = existing.gameNightId
    ? await loadGameNightProfiles(existing.gameNightId, proposedPlayers, false)
    : new Map<string, typeof gameNightProfilesTable.$inferSelect>();
  if (!gameNightProfiles || proposedPlayers.some((player) => player.gameNightProfileId && !existing.gameNightId)) {
    res.status(400).json({ error: "Choose family profiles that belong to this Game Night." });
    return;
  }
  if (mode.strategy === "first_to") {
    const target = mode.targetScore ?? 10;
    const winners = proposedPlayers.filter((player) => player.isWinner);
    if (winners.length !== 1 || (winners[0]?.score ?? 0) < target) {
      res.status(400).json({ error: `Mark the single player who first reached ${target} points.` });
      return;
    }
  }
  const players = proposedPlayers.map((player) => ({
    ...player,
    name: player.gameNightProfileId
      ? gameNightProfiles.get(player.gameNightProfileId)!.name
      : player.familyMemberId
        ? familyMembers.get(player.familyMemberId)!.name
        : player.name.trim(),
    familyMemberId: player.familyMemberId ?? null,
    gameNightProfileId: player.gameNightProfileId ?? null,
  }));
  const results = completedResults(players, mode);
  const playedAt = asDate(body.data.playedAt);
  const [session] = await db.update(gameSessionsTable).set({
    gameSlug: game.slug,
    gameTitle: game.title,
    localGameId: configured.localGameId ?? null,
    scorekeeperModeId: mode.id,
    scorekeeperModeName: mode.name,
    scorekeeperStrategy: mode.strategy,
    scoreDirection: mode.strategy === "points" ? mode.direction ?? "highest" : "highest",
    scorekeeperTarget: mode.strategy === "first_to" ? mode.targetScore ?? 10 : null,
    variation: body.data.variation ?? null,
    note: body.data.note?.trim() || null,
    players: results.players,
    score: results.score,
    winnerName: results.winnerName,
    won: results.won,
    startedAt: playedAt,
    finishedAt: playedAt,
  }).where(eq(gameSessionsTable.id, existing.id)).returning();
  await persistProfileBackupSafely(userId);
  res.json(UpdateGameSessionResponse.parse(await sessionResponse(session, { [game.slug]: game.title })));
});

router.delete("/games/sessions/:sessionId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = DeleteGameSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  const [deleted] = await db.delete(gameSessionsTable).where(and(
    eq(gameSessionsTable.id, params.data.sessionId),
    eq(gameSessionsTable.userId, userId),
    eq(gameSessionsTable.status, "complete"),
  )).returning({ id: gameSessionsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Completed game not found." });
    return;
  }
  await persistProfileBackupSafely(userId);
  DeleteGameSessionResponse.parse(undefined);
  res.status(204).end();
});

async function gameNightLeaderboardEntries(gameSlug: string, mode: ScorekeeperMode, gameNightId?: string) {
  const conditions = [
    eq(gameSessionsTable.gameSlug, gameSlug),
    eq(gameSessionsTable.scorekeeperModeId, mode.id),
    eq(gameSessionsTable.status, "complete"),
    ...(gameNightId ? [eq(gameSessionsTable.gameNightId, gameNightId)] : [isNotNull(gameSessionsTable.gameNightId)]),
  ];
  const sessions = await db.select().from(gameSessionsTable).where(and(...conditions));
  const profileIds = [...new Set(sessions.flatMap((session) => session.players
    .map((player) => player.gameNightProfileId)
    .filter((id): id is string => Boolean(id))))];
  const profiles = profileIds.length
    ? await db.select().from(gameNightProfilesTable).where(inArray(gameNightProfilesTable.id, profileIds))
    : [];
  const nightIds = [...new Set(profiles.map((profile) => profile.gameNightId))];
  const nights = nightIds.length
    ? await db.select().from(gameNightsTable).where(inArray(gameNightsTable.id, nightIds))
    : [];
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const nightsById = new Map(nights.map((night) => [night.id, night]));
  const entries = new Map<string, {
    id: string;
    username: string;
    avatarPath: string | null;
    familyMemberId: null;
    gameNightProfileId: string;
    gameNightName: string;
    score: number | null;
    gamesPlayed: number;
    wins: number;
  }>();
  for (const session of sessions) {
    const numericScores = session.players.map((player) => player.score).filter((score): score is number => typeof score === "number");
    const winningScore = mode.direction === "lowest" ? Math.min(...numericScores) : Math.max(...numericScores);
    for (const player of session.players) {
      if (!player.gameNightProfileId) continue;
      const profile = profilesById.get(player.gameNightProfileId);
      const night = profile ? nightsById.get(profile.gameNightId) : null;
      if (!profile || !night) continue;
      const entry = entries.get(profile.id) ?? {
        id: `profile:${profile.id}`,
        username: profile.name,
        avatarPath: null,
        familyMemberId: null,
        gameNightProfileId: profile.id,
        gameNightName: night.name,
        score: null,
        gamesPlayed: 0,
        wins: 0,
      };
      entry.gamesPlayed += 1;
      const isWinner = typeof player.isWinner === "boolean"
        ? player.isWinner
        : mode.strategy === "points" && typeof player.score === "number" && player.score === winningScore;
      if (isWinner) entry.wins += 1;
      if (mode.strategy === "points" && typeof player.score === "number") {
        if (entry.score === null || (mode.direction === "lowest" ? player.score < entry.score : player.score > entry.score)) {
          entry.score = player.score;
        }
      } else if (mode.strategy === "first_to" && typeof player.score === "number") {
        entry.score = Math.max(entry.score ?? 0, player.score);
      }
      entries.set(profile.id, entry);
    }
  }
  return [...entries.values()].sort((a, b) => {
    if (mode.strategy === "points") {
      const difference = (a.score ?? 0) - (b.score ?? 0);
      return (mode.direction === "lowest" ? difference : -difference) || b.wins - a.wins;
    }
    return b.wins - a.wins || b.gamesPlayed - a.gamesPlayed;
  }).slice(0, 20);
}

router.get("/games/:gameSlug/modes/:modeId/leaderboard", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = GetGameLeaderboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid game." });
    return;
  }
  const configured = await gameAndMode(params.data.gameSlug, params.data.modeId);
  if (!configured) {
    res.status(404).json({ error: "Game not found." });
    return;
  }
  const { mode } = configured;
  const sessions = await db.select().from(gameSessionsTable).where(and(
    eq(gameSessionsTable.gameSlug, params.data.gameSlug),
    eq(gameSessionsTable.scorekeeperModeId, mode.id),
    eq(gameSessionsTable.status, "complete"),
  ));
  const ownerIds = [...new Set(sessions.map((session) => session.userId))];
  const familyIds = [...new Set(sessions.flatMap((session) => session.players
    .map((player) => player.familyMemberId)
    .filter((id): id is string => Boolean(id))))];
  const profiles = ownerIds.length
    ? await db.select().from(userProfilesTable).where(inArray(userProfilesTable.userId, ownerIds))
    : [];
  const familyMembers = familyIds.length
    ? await db.select().from(familyMembersTable).where(inArray(familyMembersTable.id, familyIds))
    : [];
  const profilesById = new Map(profiles.map((profile) => [profile.userId, profile]));
  const familyById = new Map(familyMembers.map((member) => [member.id, member]));
  const entries = new Map<string, {
    id: string;
    username: string;
    avatarPath: string | null;
    familyMemberId: string | null;
    score: number | null;
    gamesPlayed: number;
    wins: number;
  }>();
  for (const session of sessions) {
    const players = session.players;
    const scores = players.map((player) => player.score).filter((score): score is number => typeof score === "number");
    const winningScore = mode.direction === "lowest" ? Math.min(...scores) : Math.max(...scores);
    for (const player of players) {
      let key: string;
      let username: string;
      let avatarPath: string | null = null;
      let familyMemberId: string | null = null;
      if (player.familyMemberId) {
        const familyMember = familyById.get(player.familyMemberId);
        if (!familyMember) continue;
        key = `family:${familyMember.id}`;
        username = familyMember.name;
        familyMemberId = familyMember.id;
      } else if (player.isYou) {
        const profile = profilesById.get(session.userId);
        key = `user:${session.userId}`;
        username = profile?.username ?? fallbackUsername(session.userId);
        avatarPath = profile?.avatarPath ?? null;
      } else {
        continue;
      }
      const entry = entries.get(key) ?? {
        id: key,
        username,
        avatarPath,
        familyMemberId,
      gameNightProfileId: null,
      gameNightName: null,
        score: null,
        gamesPlayed: 0,
        wins: 0,
      };
      entry.gamesPlayed += 1;
      const isWinner = typeof player.isWinner === "boolean"
        ? player.isWinner
        : mode.strategy === "points" && typeof player.score === "number" && player.score === winningScore;
      if (isWinner) entry.wins += 1;
      if (mode.strategy === "points" && typeof player.score === "number") {
        if (entry.score === null || (mode.direction === "lowest" ? player.score < entry.score : player.score > entry.score)) {
          entry.score = player.score;
        }
      }
      entries.set(key, entry);
    }
  }
  const scoreDirection = mode.strategy === "points" ? mode.direction ?? "highest" : null;
  const sortedEntries = [...entries.values()].sort((a, b) => {
    if (mode.strategy === "points") {
      const scoreDifference = (a.score ?? 0) - (b.score ?? 0);
      return (scoreDirection === "lowest" ? scoreDifference : -scoreDifference) || b.wins - a.wins;
    }
    return b.wins - a.wins || b.gamesPlayed - a.gamesPlayed;
  }).slice(0, 20);
  res.json(GetGameLeaderboardResponse.parse({
    gameSlug: params.data.gameSlug,
    modeId: mode.id,
    strategy: mode.strategy,
    scoreDirection,
    scope: "global",
    gameNightId: null,
    entries: sortedEntries,
  }));
});

router.get("/games/:gameSlug/modes/:modeId/leaderboard/global", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = GetGlobalGameLeaderboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid game." });
    return;
  }
  const configured = await gameAndMode(params.data.gameSlug, params.data.modeId);
  if (!configured) {
    res.status(404).json({ error: "Game not found." });
    return;
  }
  const { mode } = configured;
  res.json(GetGlobalGameLeaderboardResponse.parse({
    gameSlug: params.data.gameSlug,
    modeId: mode.id,
    strategy: mode.strategy,
    scoreDirection: mode.strategy === "points" ? mode.direction ?? "highest" : null,
    scope: "global",
    gameNightId: null,
    entries: await gameNightLeaderboardEntries(params.data.gameSlug, mode),
  }));
});

router.get("/games/:gameSlug/modes/:modeId/leaderboard/family/:gameNightId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = GetFamilyGameLeaderboardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid game or Game Night." });
    return;
  }
  const [membership] = await db.select().from(gameNightMembershipsTable).where(and(
    eq(gameNightMembershipsTable.gameNightId, params.data.gameNightId),
    eq(gameNightMembershipsTable.userId, userId),
    eq(gameNightMembershipsTable.status, "active"),
  ));
  if (!membership) {
    res.status(403).json({ error: "Join this Game Night to view its leaderboard." });
    return;
  }
  const configured = await gameAndMode(params.data.gameSlug, params.data.modeId, params.data.gameNightId);
  if (!configured) {
    res.status(404).json({ error: "Game or scorekeeper mode not found." });
    return;
  }
  const { mode } = configured;
  res.json(GetFamilyGameLeaderboardResponse.parse({
    gameSlug: params.data.gameSlug,
    modeId: mode.id,
    strategy: mode.strategy,
    scoreDirection: mode.strategy === "points" ? mode.direction ?? "highest" : null,
    scope: "family",
    gameNightId: params.data.gameNightId,
    entries: await gameNightLeaderboardEntries(params.data.gameSlug, mode, params.data.gameNightId),
  }));
});

export default router;