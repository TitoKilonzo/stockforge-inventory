import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { allowRoles, requireAuth } from "../security/auth.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

const movementSchema = z.object({
  warehouseId:z.number().int().positive(),
  productId:z.number().int().positive(),
  quantity:z.number().positive(),
  type:z.enum(["receipt","sale","issue","adjustment_in","adjustment_out","return"]),
  note:z.string().max(500).optional(),
  idempotencyKey:z.string().min(8).max(120)
});

// Critical section: update balance and append ledger entry in one transaction.
// The conditional UPDATE prevents a negative balance. Idempotency makes retries safe.
inventoryRouter.post("/movements", allowRoles("admin","manager","warehouse_staff"), async (req,res,next) => {
  try {
    const input = movementSchema.parse(req.body);
    const orgId = req.user!.organizationId;
    const duplicate = await db.execute({sql:"SELECT id FROM stock_movements WHERE organization_id=? AND idempotency_key=?",args:[orgId,input.idempotencyKey]});
    if (duplicate.rows.length) return res.status(200).json({ok:true,duplicate:true,movementId:duplicate.rows[0].id});

    const signedQty = ["receipt","adjustment_in","return"].includes(input.type) ? input.quantity : -input.quantity;
    const tx = await db.transaction("write");
    try {
      const warehouse = await tx.execute({sql:"SELECT id FROM warehouses WHERE id=? AND organization_id=?",args:[input.warehouseId,orgId]});
      const product = await tx.execute({sql:"SELECT id FROM products WHERE id=? AND organization_id=? AND active=1",args:[input.productId,orgId]});
      if (!warehouse.rows.length || !product.rows.length) {
        await tx.rollback();
        return res.status(404).json({error:"Warehouse or product not found"});
      }
      await tx.execute({sql:"INSERT INTO inventory_balances (organization_id,warehouse_id,product_id,quantity,reserved_quantity) VALUES (?,?,?,0,0) ON CONFLICT(warehouse_id,product_id) DO NOTHING",args:[orgId,input.warehouseId,input.productId]});
      const update = await tx.execute({
        sql:"UPDATE inventory_balances SET quantity=quantity+?, updated_at=CURRENT_TIMESTAMP WHERE organization_id=? AND warehouse_id=? AND product_id=? AND quantity+?>=reserved_quantity AND quantity+?>=0",
        args:[signedQty,orgId,input.warehouseId,input.productId,signedQty,signedQty]
      });
      if (Number(update.rowsAffected) !== 1) {
        await tx.rollback();
        return res.status(409).json({error:"Insufficient available stock or conflicting inventory update"});
      }
      const movement = await tx.execute({sql:`INSERT INTO stock_movements
        (organization_id,warehouse_id,product_id,movement_type,quantity_delta,idempotency_key,note,created_by)
        VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
        args:[orgId,input.warehouseId,input.productId,input.type,signedQty,input.idempotencyKey,input.note ?? null,req.user!.id]});
      await tx.commit();
      return res.status(201).json({ok:true,movementId:movement.rows[0].id});
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally { tx.close(); }
  } catch(e){next(e);}
});

inventoryRouter.get("/movements", async (req,res,next) => {
  try {
    const result = await db.execute({sql:`SELECT m.id,m.movement_type,m.quantity_delta,m.note,m.created_at,p.sku,p.name AS product_name,w.name AS warehouse_name
      FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN warehouses w ON w.id=m.warehouse_id
      WHERE m.organization_id=? ORDER BY m.created_at DESC LIMIT 100`,args:[req.user!.organizationId]});
    res.json({items:result.rows});
  } catch(e){next(e);}
});

inventoryRouter.get("/low-stock", async (req,res,next) => {
  try {
    const result = await db.execute({sql:`SELECT p.id,p.sku,p.name,p.reorder_level,COALESCE(SUM(b.quantity),0) AS quantity
      FROM products p LEFT JOIN inventory_balances b ON b.product_id=p.id AND b.organization_id=p.organization_id
      WHERE p.organization_id=? AND p.active=1 GROUP BY p.id HAVING quantity<=p.reorder_level ORDER BY quantity ASC LIMIT 100`,
      args:[req.user!.organizationId]});
    res.json({items:result.rows});
  } catch(e){next(e);}
});
