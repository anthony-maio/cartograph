export function invoiceTotal(items) {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}
