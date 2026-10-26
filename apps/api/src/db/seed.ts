import { db } from "./client.js";
import bcrypt from "bcryptjs";

const org = await db.execute({
  sql: "INSERT INTO organizations (name) VALUES (?) ON CONFLICT(name) DO NOTHING RETURNING id",
  args: ["Demo Company"]
});
let orgId = Number(org.rows[0]?.id);
if (!orgId) {
  const existing = await db.execute({sql:"SELECT id FROM organizations WHERE name = ?", args:["Demo Company"]});
  orgId = Number(existing.rows[0].id);
}
await db.execute({sql:"INSERT INTO branches (organization_id, name, code) VALUES (?, ?, ?) ON CONFLICT(organization_id, code) DO NOTHING", args:[orgId,"Nairobi Main Branch","NBO-MAIN"]});
const branch = await db.execute({sql:"SELECT id FROM branches WHERE organization_id = ? AND code = ?",args:[orgId,"NBO-MAIN"]});
const branchId = Number(branch.rows[0].id);
await db.execute({sql:"INSERT INTO warehouses (organization_id, branch_id, name, code) VALUES (?, ?, ?, ?) ON CONFLICT(organization_id, code) DO NOTHING",args:[orgId,branchId,"Main Warehouse","WH-MAIN"]});
const wh = await db.execute({sql:"SELECT id FROM warehouses WHERE organization_id = ? AND code = ?",args:[orgId,"WH-MAIN"]});
const warehouseId = Number(wh.rows[0].id);
await db.execute({sql:"INSERT INTO categories (organization_id, name) VALUES (?, ?) ON CONFLICT(organization_id, name) DO NOTHING",args:[orgId,"General"]});
const cat = await db.execute({sql:"SELECT id FROM categories WHERE organization_id = ? AND name = ?",args:[orgId,"General"]});
const products = [
  ["SKU-1001","Blue Notebook","5901234123457",120,180,20],
  ["SKU-1002","Desk Organizer","5901234123464",650,950,10],
  ["SKU-1003","USB-C Cable","5901234123471",250,400,15]
];
for (const [sku,name,barcode,cost,sell,reorder] of products) {
  const result = await db.execute({sql:`INSERT INTO products (organization_id, category_id, sku, name, barcode, cost_price, selling_price, reorder_level, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'piece') ON CONFLICT(organization_id, sku) DO NOTHING RETURNING id`,
    args:[orgId,Number(cat.rows[0].id),sku,name,barcode,cost,sell,reorder]});
  let productId = Number(result.rows[0]?.id);
  if (!productId) {
    const found = await db.execute({sql:"SELECT id FROM products WHERE organization_id = ? AND sku = ?",args:[orgId,sku]});
    productId = Number(found.rows[0].id);
  }
  await db.execute({sql:"INSERT INTO inventory_balances (organization_id, warehouse_id, product_id, quantity, reserved_quantity) VALUES (?, ?, ?, ?, 0) ON CONFLICT(warehouse_id, product_id) DO NOTHING",args:[orgId,warehouseId,productId, name==="Blue Notebook" ? 80 : name==="Desk Organizer" ? 8 : 42]});
}
// Demo-only administrator account. Change this password immediately before any public deployment.
const demoEmail = "admin@stockforgeinventory.com";
const existingAdmin = await db.execute({sql:"SELECT id FROM users WHERE email = ?",args:[demoEmail]});
if (!existingAdmin.rows.length) {
  const passwordHash = await bcrypt.hash("Admin123!", 12);
  await db.execute({sql:"INSERT INTO users (organization_id,name,email,password_hash,role) VALUES (?,?,?,?,?)",args:[orgId,"StockForge Demo Admin",demoEmail,passwordHash,"admin"]});
}
console.log("Demo data seeded. Demo administrator: admin@stockforgeinventory.com (change the demo password before deployment).");
process.exit(0);
