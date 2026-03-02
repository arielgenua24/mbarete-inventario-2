function searchProducts(products, searchTerm = undefined) {
  // Si searchTerm es undefined o null, o una cadena vacía, retornamos un array vacío (o todos los productos según se prefiera)
  if (searchTerm === undefined || searchTerm === null || searchTerm.trim() === '') {
    return [];
  }

    console.log(searchTerm == '')
  const term = searchTerm.toLowerCase();

  return products.filter((product) => {
    const nameMatch = product.name && typeof product.name === 'string' && product.name.toLowerCase().includes(term);
    const colorMatch = product.color && typeof product.color === 'string' && product.color.toLowerCase().includes(term);
    const sizeMatch = product.size && typeof product.size === 'string' && product.size.toLowerCase().includes(term);
    const codeMatch = product.productCode && typeof product.productCode === 'string' && product.productCode.toLowerCase().includes(term);

    return nameMatch || colorMatch || sizeMatch || codeMatch;
  });
}

// Ejemplo de uso:
//const products = useProducts();
//const filteredProducts = searchProducts(products, "rojo");
//console.log(filteredProducts);

export default searchProducts;