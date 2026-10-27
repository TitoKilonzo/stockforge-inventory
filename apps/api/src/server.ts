import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { inventoryRouter } from "./routes/inventory.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
const origins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map(s=>s.trim());
app.use(cors({origin:(origin,callback)=> {
  if (!origin || origins.includes(origin)) return callback(null,true);
  return callback(new Error("Origin not allowed by CORS"));
}}));
app.use(express.json({limit:"1mb"}));
app.use("/api", rateLimit({windowMs:60_000,limit:180,standardHeaders:true,legacyHeaders:false}));
app.get("/", (_req,res)=>res.json({service:"StockForge API",status:"ok",health:"/api/health",apiBase:"/api"}));
app.get("/api/health", (_req,res)=>res.json({status:"ok",service:"StockForge API",timestamp:new Date().toISOString()}));
app.use("/api/auth",rateLimit({windowMs:15*60_000,limit:20,standardHeaders:true,legacyHeaders:false}),authRouter);
app.use("/api/products",productsRouter);
app.use("/api/inventory",inventoryRouter);
app.use((_req,res)=>res.status(404).json({error:"API route not found"}));
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if (err instanceof Error && err.message === "Origin not allowed by CORS") {
    console.warn("Request rejected because its origin is not in CORS_ORIGIN");
    return res.status(403).json({error:"Origin not allowed. Add this frontend origin to CORS_ORIGIN."});
  }
  if (err instanceof ZodError) return res.status(400).json({error:"Validation failed",details:err.issues.map(i=>({path:i.path,message:i.message}))});
  if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) return res.status(409).json({error:"A record with this identifier already exists"});
  console.error(err);
  return res.status(500).json({error:"Internal server error"});
});
const port = Number(process.env.PORT || 4000);
app.listen(port,()=>console.log(`StockForge API listening on ${port}`));
