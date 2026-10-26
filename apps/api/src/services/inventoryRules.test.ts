import { describe,it,expect } from "vitest";
import { canFulfil,signedQuantity } from "./inventoryRules.js";
describe("inventory rules",()=>{
  it("increases stock for receipts",()=>expect(signedQuantity("receipt",5)).toBe(5));
  it("decreases stock for sales",()=>expect(signedQuantity("sale",2)).toBe(-2));
  it("rejects non-positive quantities",()=>expect(()=>signedQuantity("issue",0)).toThrow());
  it("prevents negative stock",()=>expect(canFulfil(4,0,-5)).toBe(false));
  it("does not consume reserved stock",()=>expect(canFulfil(10,7,-4)).toBe(false));
  it("allows valid issue",()=>expect(canFulfil(10,2,-3)).toBe(true));
});
