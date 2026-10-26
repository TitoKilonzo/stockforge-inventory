export function signedQuantity(type: "receipt"|"sale"|"issue"|"adjustment_in"|"adjustment_out"|"return", quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be a positive number");
  return ["receipt","adjustment_in","return"].includes(type) ? quantity : -quantity;
}
export function canFulfil(current: number, reserved: number, delta: number): boolean {
  return current + delta >= 0 && current + delta >= reserved;
}
