import { getOrderTotalValue } from './orderLocations';

export const REPORT_PERIODS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

export function getOrderDate(order) {
  if (order.createdAt) {
    if (order.createdAt.toDate) {
      return order.createdAt.toDate();
    }

    if (order.createdAt instanceof Date) {
      return order.createdAt;
    }

    return new Date(order.createdAt);
  }

  if (order.fecha) {
    const [datePart, timePart] = order.fecha.split(', ');
    const [day, month, year] = datePart.split('/');
    return new Date(`${year}-${month}-${day}T${timePart || '00:00'}`);
  }

  return null;
}

export function sumOrders(orders) {
  return orders.reduce((sum, order) => sum + getOrderTotalValue(order), 0);
}

export function filterOrdersByPeriod(orders, period, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  if (period === REPORT_PERIODS.DAILY) {
    return orders.filter((order) => {
      const orderDate = getOrderDate(order);
      if (!orderDate) {
        return false;
      }

      const orderDay = new Date(orderDate);
      orderDay.setHours(0, 0, 0, 0);
      return orderDay.getTime() === today.getTime();
    });
  }

  if (period === REPORT_PERIODS.WEEKLY) {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return orders.filter((order) => {
      const orderDate = getOrderDate(order);
      return orderDate && orderDate >= weekAgo;
    });
  }

  if (period === REPORT_PERIODS.MONTHLY) {
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return orders.filter((order) => {
      const orderDate = getOrderDate(order);
      return orderDate && orderDate >= monthAgo;
    });
  }

  return orders;
}

export function groupOrdersByDay(orders) {
  const groups = {};

  orders.forEach((order) => {
    const orderDate = getOrderDate(order);

    if (!orderDate) {
      return;
    }

    const key = orderDate.toLocaleDateString('es-ES');

    if (!groups[key]) {
      groups[key] = {
        date: orderDate,
        orders: [],
      };
    }

    groups[key].orders.push(order);
  });

  return Object.values(groups)
    .map((group) => ({
      ...group,
      total: sumOrders(group.orders),
    }))
    .sort((a, b) => b.date - a.date);
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
