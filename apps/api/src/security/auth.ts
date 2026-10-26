import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type Role = "admin" | "manager" | "warehouse_staff" | "purchasing" | "auditor";
export interface AuthUser { id: number; organizationId: number; role: Role; email: string }
declare global { namespace Express { interface Request { user?: AuthUser } } }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
    const payload = jwt.verify(header.slice(7), secret) as jwt.JwtPayload;
    req.user = { id: Number(payload.sub), organizationId: Number(payload.org), role: payload.role as Role, email: String(payload.email) };
    if (!req.user.id || !req.user.organizationId || !req.user.role) throw new Error("Invalid token");
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function allowRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}
