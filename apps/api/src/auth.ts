import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "./env.js";

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const hdr = req.header("authorization") ?? "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice("Bearer ".length) : null;
  if (!token) return res.status(401).json({ error: "missing_token" });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
    if (!payload.sub) return res.status(401).json({ error: "invalid_token" });
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

