function searchOrders(orders, searchTerm = '') {
  if (!searchTerm) return [];
  if (!Array.isArray(orders)) return [];

  const term = searchTerm.toLowerCase();
  const normalize = (value) => (value ?? '').toString().toLowerCase();

  return orders.filter((order) => {
    const cliente = normalize(order?.cliente);
    const direccion = normalize(order?.direccion);
    const estado = normalize(order?.estado ?? order?.status);
    const orderCode = normalize(order?.orderCode);
    const telefono = normalize(order?.telefono);
    const fecha = normalize(order?.fecha);

    return (
      cliente.includes(term) ||
      direccion.includes(term) ||
      estado.includes(term) ||
      orderCode.includes(term) ||
      telefono.includes(term) ||
      fecha.includes(term)
    );
  });
}

export default searchOrders;
