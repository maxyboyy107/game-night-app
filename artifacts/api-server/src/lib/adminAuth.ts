import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const ADMIN_COOKIE = "games_io_admin";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type ClerkRequest = Request & {
  auth?: () => { userId: string | null };
};

function getUserId(req: Request): string | null {
  const auth = (req as ClerkRequest).auth;
  if (typeof auth !== "function") return null;
  return auth().userId;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for admin sessions");
  return secret;
}

function signature(userId: string, issuedAt: number): string {
  return createHmac("sha256", getSessionSecret()).update(`${userId}:${issuedAt}`).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signedInUserId(req: Request): string | null {
  return getUserId(req);
}

export function passwordMatches(password: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  return Boolean(configuredPassword && safeEqual(password, configuredPassword));
}

export function issueAdminSession(res: Response, userId: string): void {
  const issuedAt = Date.now();
  res.cookie(ADMIN_COOKIE, `${issuedAt}.${signature(userId, issuedAt)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_TTL_MS,
    path: "/",
  });
}

export function hasAdminSession(req: Request, userId: string): boolean {
  const rawCookie = req.cookies?.[ADMIN_COOKIE];
  if (typeof rawCookie !== "string") return false;
  const [issuedAtText, providedSignature] = rawCookie.split(".");
  const issuedAt = Number(issuedAtText);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > ADMIN_SESSION_TTL_MS || Date.now() < issuedAt) return false;
  return safeEqual(providedSignature || "", signature(userId, issuedAt));
}

export function clearAdminSession(res: Response): void {
  res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}