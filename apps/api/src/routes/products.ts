import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { allowRoles, requireAuth } from "../security/auth.js";

export const productsRouter = Router();
productsRouter.use(requireAuth);

const productSchema = z.object({
  sku:z.string().trim().min(1).max(80),
  name:z.string().trim().min(1).max(180),
  barcode:z.string().trim().max(100).optional().nullable(),
  categoryId:z.number().int().positive().optional().nullable(),
  unit:z.string().trim().min(1).max(30).default("piece"),
  costPrice:z.number().min(0).default(0),
  sellingPrice:z.number().min(0).default(0),
  reorderLevel:z.number().min(0).default(0),
  trackExpiry:z.boolean().default(false)
});

productsRouter.get("/", async (req,res,next) => {
  try {
    const q = String(req.query.q || "").trim().slice(0,100);
    const result = await db.execute({
      sql:`SELECT p.id,p.sku,p.name,p.barcode,p.unit,p.cost_price,p.selling_price,p.reorder_level,p.track_expiry,
        COALESCE(SUM(b.quantity),0) AS total_quantity
        FROM products p LEFT JOIN inventory_balances b ON b.product_id=p.id AND b.organization_id=p.organization_id
        WHERE p.organization_id=? AND p.active=1 AND (p.name LIKE ? OR p.sku LIKE ? OR COALESCE(p.barcode,'') LIKE ?)
        GROUP BY p.id ORDER BY p.name LIMIT 250`,
      args:[req.user!.organizationId,`%${q}%`,`%${q}%`,`%${q}%`]
    });
    res.json({items:result.rows});
  } catch(e){next(e);}
});

productsRouter.post("/", allowRoles("admin","manager","purchasing"), async (req,res,next) => {
  try {
    const p = productSchema.parse(req.body);
    const result = await db.execute({sql:`INSERT INTO products
      (organization_id,category_id,sku,name,barcode,unit,cost_price,selling_price,reorder_level,track_expiry)
      VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING *`,
      args:[req.user!.organizationId,p.categoryId ?? null,p.sku,p.name,p.barcode ?? null,p.unit,p.costPrice,p.sellingPrice,p.reorderLevel,p.trackExpiry?1:0]});
    res.status(201).json({item:result.rows[0]});
  } catch(e){next(e);}
});
