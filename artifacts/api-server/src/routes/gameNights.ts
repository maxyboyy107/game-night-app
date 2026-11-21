import { randomInt, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  gameNightHouseRulesTable,
  gameNightLocalGamesTable,
  gameNightMembershipsTable,
  gameNightProfilesTable,
  gameNightsTable,
  gameSessionsTable,
  userProfilesTable,
} from "@workspace/db";
import {
  CreateGameNightBody,
  CreateGameNightLocalGameBody,
  CreateGameNightLocalGameParams,
  CreateGameNightLocalGameResponse,
  CreateGameNightProfileBody,
  CreateGameNightProfileResponse,
  CreateGameNightResponse,
  DeleteGameNightLocalGameParams,
  DeleteGameNightLocalGameResponse,
  GetGameNightParams,
  GetGameNightResponse,
  InviteToGameNightBody,
  InviteToGameNightParams,
  InviteToGameNightResponse,
  JoinGameNightBody,
  JoinGameNightResponse,
  ListGameNightsResponse,
  SaveGameNightHouseRulesBody,
  SaveGameNightHouseRulesParams,
  SaveGameNightHouseRulesResponse,
  UpdateGameNightLocalGameBody,
  UpdateGameNightLocalGameParams,
  UpdateGameNightLocalGameResponse,
  UpdateGameNightMembershipBody,
  UpdateGameNightMembershipParams,
  UpdateGameNightMembershipResponse,
  UpdateGameNightProfileBody,
  UpdateGameNightProfileParams,
  UpdateGameNightProfileResponse,
} from "@workspace/api-zod";
import type { ScorekeeperMode } from "@workspace/catalog";
import { signedInUserId } from "../lib/adminAuth";

const router: IRouter = Router();
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
type AccessMode = "public" | "invitational" | "private";

function requireUser(req: Request, res: Response): string | null {
  const userId = signedInUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to use Game Nights." });
    return null;
  }
  return userId;
}

function fallbackUsername(userId: string): string {
  return `player_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toLowerCase() || "guest"}`;
}

async function ensureAccountProfile(userId: string): Promise<void> {
  await db.insert(userProfilesTable).values({
    userId,
    username: fallbackUsername(userId),
  }).onConflictDoNothing();
}

async function getActiveMembership(gameNightId: string, userId: string) {
  const [membership] = await db.select().from(gameNightMembershipsTable).where(and(
    eq(gameNightMembershipsTable.gameNightId, gameNightId),
    eq(gameNightMembershipsTable.userId, userId),
    eq(gameNightMembershipsTable.status, "active"),
  ));
  return membership;
}

async function getHostNight(gameNightId: string, userId: string) {
  const [night] = await db.select().from(gameNightsTable).where(eq(gameNightsTable.id, gameNightId));
  if (!night) return null;
  const membership = await getActiveMembership(gameNightId, userId);
  if (!membership || night.hostUserId !== userId || membership.role !== "host") return null;
  return night;
}

async function summaryFor(night: typeof gameNightsTable.$inferSelect, role: "host" | "member") {
  const activeMembers = await db.select({ id: gameNightMembershipsTable.id }).from(gameNightMembershipsTable).where(and(
    eq(gameNightMembershipsTable.gameNightId, night.id),
    eq(gameNightMembershipsTable.status, "active"),
  ));
  return {
    id: night.id,
    name: night.name,
    accessMode: night.accessMode as AccessMode,
    joinCode: night.accessMode === "private" ? null : night.joinCode,
    role,
    memberCount: activeMembers.length,
  };
}

function serializeSession(row: typeof gameSessionsTable.$inferSelect) {
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
    familyMemberId: player.familyMemberId ?? null,
    gameNightProfileId: player.gameNightProfileId ?? null,
    isWinner: typeof player.isWinner === "boolean"
      ? player.isWinner
      : strategy === "points" && typeof player.score === "number" && player.score === winningScore,
  }));
  return {
    id: row.id,
    gameSlug: row.gameSlug,
    gameTitle: row.gameTitle || row.gameSlug,
    players,
    score: strategy === "winner" ? null : row.score,
    status: row.status === "complete" ? "complete" : "active",
    winnerName: row.winnerName || players.filter((player) => player.isWinner).map((player) => player.name).join(" / ") || null,
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
    playedAt: (row.finishedAt ?? row.startedAt).toISOString(),
  };
}

router.get("/game-nights", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  await ensureAccountProfile(userId);
  const memberships = await db.select({
    membership: gameNightMembershipsTable,
    night: gameNightsTable,
  }).from(gameNightMembershipsTable).innerJoin(
    gameNightsTable,
    eq(gameNightMembershipsTable.gameNightId, gameNightsTable.id),
  ).where(and(
    eq(gameNightMembershipsTable.userId, userId),
    eq(gameNightMembershipsTable.status, "active"),
  )).orderBy(desc(gameNightsTable.updatedAt));
  const gameNights = await Promise.all(memberships.map(({ membership, night }) =>
    summaryFor(night, membership.role === "host" ? "host" : "member")));

  const invitations = await db.select({
    membershipId: gameNightMembershipsTable.id,
    gameNightId: gameNightsTable.id,
    gameNightName: gameNightsTable.name,
    accessMode: gameNightsTable.accessMode,
    hostUserId: gameNightsTable.hostUserId,
  }).from(gameNightMembershipsTable).innerJoin(
    gameNightsTable,
    eq(gameNightMembershipsTable.gameNightId, gameNightsTable.id),
  ).where(and(
    eq(gameNightMembershipsTable.userId, userId),
    eq(gameNightMembershipsTable.status, "invited"),
  ));
  const hostIds = [...new Set(invitations.map((item) => item.hostUserId))];
  const hosts = hostIds.length
    ? await db.select().from(userProfilesTable).where(inArray(userProfilesTable.userId, hostIds))
    : [];
  const hostNames = new Map(hosts.map((host) => [host.userId, host.username]));
  res.json(ListGameNightsResponse.parse({
    gameNights,
    invitations: invitations.map((invitation) => ({
      membershipId: invitation.membershipId,
      gameNightId: invitation.gameNightId,
      gameNightName: invitation.gameNightName,
      accessMode: invitation.accessMode,
      hostUsername: hostNames.get(invitation.hostUserId) ?? fallbackUsername(invitation.hostUserId),
    })),
  }));
});

router.post("/game-nights", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const body = CreateGameNightBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter a Game Night name and access type." });
    return;
  }
  await ensureAccountProfile(userId);
  const accessMode = body.data.accessMode as AccessMode;
  const joinCode = accessMode === "private" ? null : Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  const night = await db.transaction(async (tx) => {
    const [created] = await tx.insert(gameNightsTable).values({
      name: body.data.name.trim(),
      hostUserId: userId,
      accessMode,
      joinCode,
    }).returning();
    await tx.insert(gameNightMembershipsTable).values({
      gameNightId: created.id,
      userId,
      role: "host",
      status: "active",
    });
    return created;
  });
  res.status(201).json(CreateGameNightResponse.parse(await summaryFor(night, "host")));
});

router.post("/game-nights/join", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const body = JoinGameNightBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter a four-letter Game Night code." });
    return;
  }
  const [night] = await db.select().from(gameNightsTable).where(eq(gameNightsTable.joinCode, body.data.code.toUpperCase()));
  if (!night || night.accessMode === "private") {
    res.status(404).json({ error: "That Game Night code is not available." });
    return;
  }
  const [existing] = await db.select().from(gameNightMembershipsTable).where(and(
    eq(gameNightMembershipsTable.gameNightId, night.id),
    eq(gameNightMembershipsTable.userId, userId),
  ));
  if (existing?.status === "active") {
    res.json(JoinGameNightResponse.parse({ status: "already_member", gameNight: await summaryFor(night, existing.role === "host" ? "host" : "member") }));
    return;
  }
  const status = night.accessMode === "public" ? "active" : "pending";
  await db.insert(gameNightMembershipsTable).values({
    gameNightId: night.id,
    userId,
    role: "member",
    status,
  }).onConflictDoUpdate({
    target: [gameNightMembershipsTable.gameNightId, gameNightMembershipsTable.userId],
    set: { status, role: "member", invitedBy: null, updatedAt: new Date() },
  });
  const [membership] = await db.select().from(gameNightMembershipsTable).where(and(
    eq(gameNightMembershipsTable.gameNightId, night.id),
    eq(gameNightMembershipsTable.userId, userId),
  ));
  res.json(JoinGameNightResponse.parse({
    status: status === "active" ? "joined" : "pending",
    gameNight: await summaryFor(night, membership.role === "host" ? "host" : "member"),
  }));
});

router.get("/game-nights/:gameNightId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = GetGameNightParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid Game Night." });
    return;
  }
  const [night] = await db.select().from(gameNightsTable).where(eq(gameNightsTable.id, params.data.gameNightId));
  if (!night) {
    res.status(404).json({ error: "Game Night not found." });
    return;
  }
  const membership = await getActiveMembership(night.id, userId);
  if (!membership) {
    res.status(403).json({ error: "Join this Game Night to view it." });
    return;
  }
  const isHost = night.hostUserId === userId;
  const memberRows = await db.select({
    id: gameNightMembershipsTable.id,
    userId: gameNightMembershipsTable.userId,
    role: gameNightMembershipsTable.role,
    status: gameNightMembershipsTable.status,
    username: userProfilesTable.username,
  }).from(gameNightMembershipsTable).leftJoin(
    userProfilesTable,
    eq(gameNightMembershipsTable.userId, userProfilesTable.userId),
  ).where(and(
    eq(gameNightMembershipsTable.gameNightId, night.id),
    isHost ? inArray(gameNightMembershipsTable.status, ["active", "pending", "invited"]) : eq(gameNightMembershipsTable.status, "active"),
  ));
  const [profiles, houseRules, localGames, timeline] = await Promise.all([
    db.select().from(gameNightProfilesTable).where(eq(gameNightProfilesTable.gameNightId, night.id)).orderBy(gameNightProfilesTable.name),
    db.select().from(gameNightHouseRulesTable).where(eq(gameNightHouseRulesTable.gameNightId, night.id)).orderBy(gameNightHouseRulesTable.gameSlug),
    db.select().from(gameNightLocalGamesTable).where(eq(gameNightLocalGamesTable.gameNightId, night.id)).orderBy(gameNightLocalGamesTable.title),
    db.select().from(gameSessionsTable).where(and(
      eq(gameSessionsTable.gameNightId, night.id),
      eq(gameSessionsTable.status, "complete"),
    )).orderBy(desc(gameSessionsTable.startedAt)).limit(50),
  ]);
  res.json(GetGameNightResponse.parse({
    night: await summaryFor(night, membership.role === "host" ? "host" : "member"),
    members: memberRows.map((member) => ({
      id: member.id,
      username: member.username ?? fallbackUsername(member.userId),
      role: member.role === "host" ? "host" : "member",
      status: member.status,
    })),
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      isActive: profile.isActive,
      createdAt: profile.createdAt.toISOString(),
    })),
    houseRules: houseRules.map((rule) => ({
      gameSlug: rule.gameSlug,
      rulesText: rule.rulesText,
      variation: rule.variation,
      rulesVersion: rule.rulesVersion,
      updatedAt: rule.updatedAt.toISOString(),
    })),
    localGames: localGames.map((game) => ({
      id: game.id,
      slug: game.slug,
      title: game.title,
      description: game.description,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      rules: game.rules,
      scorekeeperModes: game.scorekeeperModes,
      variations: game.variations,
      createdAt: game.createdAt.toISOString(),
    })),
    timeline: timeline.map(serializeSession),
  }));
});

router.patch("/game-nights/:gameNightId/members/:membershipId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = UpdateGameNightMembershipParams.safeParse(req.params);
  const body = UpdateGameNightMembershipBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Choose a valid membership action." });
    return;
  }
  const [night] = await db.select().from(gameNightsTable).where(eq(gameNightsTable.id, params.data.gameNightId));
  const [target] = await db.select().from(gameNightMembershipsTable).where(and(
    eq(gameNightMembershipsTable.id, params.data.membershipId),
    eq(gameNightMembershipsTable.gameNightId, params.data.gameNightId),
  ));
  if (!night || !target) {
    res.status(404).json({ error: "Membership not found." });
    return;
  }
  const host = night.hostUserId === userId && target.status !== "denied";
  const self = target.userId === userId;
  if (body.data.action === "remove") {
    if ((!host && !self) || target.role === "host") {
      res.status(403).json({ error: "Only the host can remove another member." });
      return;
    }
    await db.delete(gameNightMembershipsTable).where(eq(gameNightMembershipsTable.id, target.id));
    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, target.userId));
    res.json(UpdateGameNightMembershipResponse.parse({
      id: target.id,
      username: profile?.username ?? fallbackUsername(target.userId),
      role: target.role === "host" ? "host" : "member",
      status: "denied",
    }));
    return;
  }
  const hostResponding = host && target.status === "pending";
  const inviteeResponding = self && target.status === "invited";
  if (!hostResponding && !inviteeResponding) {
    res.status(403).json({ error: "Only the host can review requests, and only invitees can accept invitations." });
    return;
  }
  const status = body.data.action === "accept" ? "active" : "denied";
  const [updated] = await db.update(gameNightMembershipsTable).set({ status, updatedAt: new Date() })
    .where(eq(gameNightMembershipsTable.id, target.id)).returning();
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, target.userId));
  res.json(UpdateGameNightMembershipResponse.parse({
    id: updated.id,
    username: profile?.username ?? fallbackUsername(target.userId),
    role: updated.role === "host" ? "host" : "member",
    status: updated.status,
  }));
});

router.post("/game-nights/:gameNightId/invites", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = InviteToGameNightParams.safeParse(req.params);
  const body = InviteToGameNightBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Enter a valid account username." });
    return;
  }
  const night = await getHostNight(params.data.gameNightId, userId);
  if (!night || night.accessMode !== "private") {
    res.status(403).json({ error: "Only the host can invite accounts to a private Game Night." });
    return;
  }
  const [profile] = await db.select().from(userProfilesTable).where(sql`lower(${userProfilesTable.username}) = ${body.data.username.trim().toLowerCase()}`);
  if (!profile || profile.userId === userId) {
    res.status(404).json({ error: "No other account was found with that username." });
    return;
  }
  const [existing] = await db.select().from(gameNightMembershipsTable).where(and(
    eq(gameNightMembershipsTable.gameNightId, night.id),
    eq(gameNightMembershipsTable.userId, profile.userId),
  ));
  if (existing?.status === "active") {
    res.status(400).json({ error: "That account is already in this Game Night." });
    return;
  }
  const [invitation] = await db.insert(gameNightMembershipsTable).values({
    gameNightId: night.id,
    userId: profile.userId,
    role: "member",
    status: "invited",
    invitedBy: userId,
  }).onConflictDoUpdate({
    target: [gameNightMembershipsTable.gameNightId, gameNightMembershipsTable.userId],
    set: { status: "invited", role: "member", invitedBy: userId, updatedAt: new Date() },
  }).returning();
  res.status(201).json(InviteToGameNightResponse.parse({
    id: invitation.id,
    username: profile.username,
    role: "member",
    status: "invited",
  }));
});

router.post("/game-nights/:gameNightId/profiles", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = GetGameNightParams.safeParse(req.params);
  const body = CreateGameNightProfileBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Enter a profile name." });
    return;
  }
  if (!await getHostNight(params.data.gameNightId, userId)) {
    res.status(403).json({ error: "Only the Game Night host can manage family profiles." });
    return;
  }
  const [profile] = await db.insert(gameNightProfilesTable).values({
    gameNightId: params.data.gameNightId,
    name: body.data.name.trim(),
    createdByUserId: userId,
  }).returning();
  res.status(201).json(CreateGameNightProfileResponse.parse({
    id: profile.id,
    name: profile.name,
    isActive: profile.isActive,
    createdAt: profile.createdAt.toISOString(),
  }));
});

router.patch("/game-nights/:gameNightId/profiles/:profileId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = UpdateGameNightProfileParams.safeParse(req.params);
  const body = UpdateGameNightProfileBody.safeParse(req.body);
  if (!params.success || !body.success || (!body.data.name && body.data.isActive === undefined)) {
    res.status(400).json({ error: "Provide a profile name or active status." });
    return;
  }
  if (!await getHostNight(params.data.gameNightId, userId)) {
    res.status(403).json({ error: "Only the Game Night host can manage family profiles." });
    return;
  }
  const [profile] = await db.update(gameNightProfilesTable).set({
    ...(body.data.name ? { name: body.data.name.trim() } : {}),
    ...(body.data.isActive === undefined ? {} : { isActive: body.data.isActive }),
    updatedAt: new Date(),
  }).where(and(
    eq(gameNightProfilesTable.id, params.data.profileId),
    eq(gameNightProfilesTable.gameNightId, params.data.gameNightId),
  )).returning();
  if (!profile) {
    res.status(404).json({ error: "Family profile not found." });
    return;
  }
  res.json(UpdateGameNightProfileResponse.parse({
    id: profile.id,
    name: profile.name,
    isActive: profile.isActive,
    createdAt: profile.createdAt.toISOString(),
  }));
});

router.put("/game-nights/:gameNightId/house-rules/:gameSlug", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = SaveGameNightHouseRulesParams.safeParse(req.params);
  const body = SaveGameNightHouseRulesBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Provide valid house rules and a rules version." });
    return;
  }
  if (!await getHostNight(params.data.gameNightId, userId)) {
    res.status(403).json({ error: "Only the Game Night host can edit house rules." });
    return;
  }
  const values = {
    gameNightId: params.data.gameNightId,
    gameSlug: params.data.gameSlug,
    rulesText: body.data.rulesText?.trim() || null,
    variation: body.data.variation?.trim() || null,
    rulesVersion: body.data.rulesVersion?.trim() || null,
    updatedByUserId: userId,
    updatedAt: new Date(),
  };
  const [saved] = await db.insert(gameNightHouseRulesTable).values(values).onConflictDoUpdate({
    target: [gameNightHouseRulesTable.gameNightId, gameNightHouseRulesTable.gameSlug],
    set: {
      rulesText: values.rulesText,
      variation: values.variation,
      rulesVersion: values.rulesVersion,
      updatedByUserId: userId,
      updatedAt: values.updatedAt,
    },
  }).returning();
  res.json(SaveGameNightHouseRulesResponse.parse({
    gameSlug: saved.gameSlug,
    rulesText: saved.rulesText,
    variation: saved.variation,
    rulesVersion: saved.rulesVersion,
    updatedAt: saved.updatedAt.toISOString(),
  }));
});

router.post("/game-nights/:gameNightId/local-games", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = CreateGameNightLocalGameParams.safeParse(req.params);
  const body = CreateGameNightLocalGameBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.minPlayers > body.data.maxPlayers) {
    res.status(400).json({ error: "Enter a valid local game and player range." });
    return;
  }
  if (!await getHostNight(params.data.gameNightId, userId)) {
    res.status(403).json({ error: "Only the Game Night host can create local games." });
    return;
  }
  const id = randomUUID();
  const [game] = await db.insert(gameNightLocalGamesTable).values({
    id,
    gameNightId: params.data.gameNightId,
    slug: `local-${id}`,
    title: body.data.title.trim(),
    description: body.data.description.trim(),
    minPlayers: body.data.minPlayers,
    maxPlayers: body.data.maxPlayers,
    rules: body.data.rules.trim(),
    scorekeeperModes: body.data.scorekeeperModes,
    variations: body.data.variations,
    createdByUserId: userId,
  }).returning();
  res.status(201).json(CreateGameNightLocalGameResponse.parse({
    ...game,
    createdAt: game.createdAt.toISOString(),
  }));
});

router.put("/game-nights/:gameNightId/local-games/:localGameId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = UpdateGameNightLocalGameParams.safeParse(req.params);
  const body = UpdateGameNightLocalGameBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.minPlayers > body.data.maxPlayers) {
    res.status(400).json({ error: "Enter a valid local game and player range." });
    return;
  }
  if (!await getHostNight(params.data.gameNightId, userId)) {
    res.status(403).json({ error: "Only the Game Night host can edit local games." });
    return;
  }
  const [game] = await db.update(gameNightLocalGamesTable).set({
    title: body.data.title.trim(),
    description: body.data.description.trim(),
    minPlayers: body.data.minPlayers,
    maxPlayers: body.data.maxPlayers,
    rules: body.data.rules.trim(),
    scorekeeperModes: body.data.scorekeeperModes,
    variations: body.data.variations,
    updatedAt: new Date(),
  }).where(and(
    eq(gameNightLocalGamesTable.id, params.data.localGameId),
    eq(gameNightLocalGamesTable.gameNightId, params.data.gameNightId),
  )).returning();
  if (!game) {
    res.status(404).json({ error: "Local game not found." });
    return;
  }
  res.json(UpdateGameNightLocalGameResponse.parse({
    ...game,
    createdAt: game.createdAt.toISOString(),
  }));
});

router.delete("/game-nights/:gameNightId/local-games/:localGameId", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const params = DeleteGameNightLocalGameParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid local game." });
    return;
  }
  if (!await getHostNight(params.data.gameNightId, userId)) {
    res.status(403).json({ error: "Only the Game Night host can remove local games." });
    return;
  }
  const [deleted] = await db.delete(gameNightLocalGamesTable).where(and(
    eq(gameNightLocalGamesTable.id, params.data.localGameId),
    eq(gameNightLocalGamesTable.gameNightId, params.data.gameNightId),
  )).returning({ id: gameNightLocalGamesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Local game not found." });
    return;
  }
  res.status(204).json(DeleteGameNightLocalGameResponse.parse(undefined));
});

export default router;
