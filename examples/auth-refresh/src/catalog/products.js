export function availableProducts(products) {
  return products.filter(product => product.stock > 0);
}
