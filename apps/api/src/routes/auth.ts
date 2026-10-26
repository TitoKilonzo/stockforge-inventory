import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { db } from "../db/client.js";

export const authRouter = Router();
const registerSchema = z.object({ name:z.string().min(2).max(100), email:z.string().email().max(254), password:z.string().min(12).max(128) });
const loginSchema = z.object({ email:z.string().email(), password:z.string().min(1).max(128) });

function tokenFor(user: {id:number; organization_id:number; role:string; email:string}) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Configure JWT_SECRET with at least 32 characters");
  const expiresIn = process.env.JWT_EXPIRES_IN || "8h";
  return jwt.sign({ org:user.organization_id, role:user.role, email:user.email }, secret, { subject:String(user.id), expiresIn:expiresIn as SignOptions["expiresIn"] });
}

authRouter.post("/register", async (req,res,next) => {
  try {
    const input = registerSchema.parse(req.body);
    // Starter onboarding: first registered account creates the initial organization and becomes admin.
    // Before public launch, disable this endpoint or use invitation-only registration.
    const existing = await db.execute("SELECT id FROM users LIMIT 1");
    if (existing.rows.length) return res.status(403).json({error:"Registration is closed. Ask your administrator for an invitation."});
    const org = await db.execute({sql:"INSERT INTO organizations (name) VALUES (?) RETURNING id",args:[`${input.name}'s Organization`]});
    const organizationId = Number(org.rows[0].id);
    const hash = await bcrypt.hash(input.password, 12);
    const result = await db.execute({sql:"INSERT INTO users (organization_id,name,email,password_hash,role) VALUES (?,?,?,?,?) RETURNING id,organization_id,role,email",args:[organizationId,input.name,input.email.toLowerCase(),hash,"admin"]});
    const user = result.rows[0] as unknown as {id:number;organization_id:number;role:string;email:string};
    return res.status(201).json({token:tokenFor(user),user:{id:user.id,email:user.email,role:user.role,organizationId:user.organization_id}});
  } catch (e) { next(e); }
});

authRouter.post("/login", async (req,res,next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await db.execute({sql:"SELECT id,organization_id,role,email,password_hash,active FROM users WHERE email = ?",args:[input.email.toLowerCase()]});
    const user = result.rows[0] as unknown as {id:number;organization_id:number;role:string;email:string;password_hash:string;active:number}|undefined;
    if (!user || !user.active || !(await bcrypt.compare(input.password,user.password_hash))) return res.status(401).json({error:"Invalid email or password"});
    return res.json({token:tokenFor(user),user:{id:user.id,email:user.email,role:user.role,organizationId:user.organization_id}});
  } catch (e) { next(e); }
});
