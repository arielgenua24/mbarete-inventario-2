export const ORDER_LOCATIONS = {
  CENTRAL: 'central',
  LOCAL_AVELLANEDA: 'local_avellaneda',
};

export const ORDER_SCOPES = {
  CENTRAL: ORDER_LOCATIONS.CENTRAL,
  LOCAL_AVELLANEDA: ORDER_LOCATIONS.LOCAL_AVELLANEDA,
  TOTAL: 'total',
};

export const DEFAULT_ADMIN_EMAIL = 'mariajoseruizdiaz41@gmail.com';

export const DEFAULT_EMPLOYEE_LOCATIONS = {
  'empleado@gmail.com': ORDER_LOCATIONS.LOCAL_AVELLANEDA,
};

export const DEFAULT_APP_CONFIG = {
  admin: DEFAULT_ADMIN_EMAIL,
  adminEmail: DEFAULT_ADMIN_EMAIL,
  employeeLocations: DEFAULT_EMPLOYEE_LOCATIONS,
};

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function sanitizeLocation(location) {
  if (location === ORDER_LOCATIONS.LOCAL_AVELLANEDA) {
    return ORDER_LOCATIONS.LOCAL_AVELLANEDA;
  }

  return ORDER_LOCATIONS.CENTRAL;
}

export function normalizeAppConfig(rawConfig = {}) {
  const admin = normalizeEmail(rawConfig.admin || rawConfig.adminEmail || DEFAULT_ADMIN_EMAIL) || DEFAULT_ADMIN_EMAIL;
  const rawEmployeeLocations = rawConfig.employeeLocations && typeof rawConfig.employeeLocations === 'object'
    ? rawConfig.employeeLocations
    : {};

  const normalizedEmployeeLocations = {
    ...DEFAULT_EMPLOYEE_LOCATIONS,
  };

  Object.entries(rawEmployeeLocations).forEach(([email, location]) => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return;
    }

    normalizedEmployeeLocations[normalizedEmail] = sanitizeLocation(location);
  });

  return {
    admin,
    adminEmail: admin,
    employeeLocations: normalizedEmployeeLocations,
  };
}

export function normalizeOrderLocation(order = {}) {
  return sanitizeLocation(order.location);
}

export function matchesOrderScope(order, scope) {
  if (scope === ORDER_SCOPES.TOTAL) {
    return true;
  }

  return normalizeOrderLocation(order) === scope;
}

export function getScopeLabel(scope) {
  switch (scope) {
    case ORDER_SCOPES.LOCAL_AVELLANEDA:
      return 'Local Avellaneda';
    case ORDER_SCOPES.CENTRAL:
      return 'Central';
    case ORDER_SCOPES.TOTAL:
      return 'Total';
    default:
      return 'Central';
  }
}

export function getUserLocationFromConfig(email, config) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  if (normalizedEmail === normalizeEmail(config.admin)) {
    return ORDER_LOCATIONS.CENTRAL;
  }

  return config.employeeLocations[normalizedEmail] || null;
}

export function getOrderTotalValue(order = {}) {
  const totalAmount = Number(order.totalAmount);
  if (Number.isFinite(totalAmount) && totalAmount > 0) {
    return totalAmount;
  }

  const total = Number(order.total);
  if (Number.isFinite(total) && total > 0) {
    return total;
  }

  return 0;
}
