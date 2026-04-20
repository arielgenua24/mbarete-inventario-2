import { Link, useLocation } from 'react-router-dom';
import { Home, Package, PlusCircle, ClipboardList, MessageSquare, Users } from 'lucide-react';
import './styles.css';

const NAV_ITEMS = [
  { to: '/home',      icon: Home,          label: 'Inicio' },
  { to: '/inventory', icon: Package,        label: 'Inventario' },
  { to: '/new-order', icon: PlusCircle,     label: 'Nuevo Pedido' },
  { to: '/orders',    icon: ClipboardList,  label: 'Pedidos' },
  { to: '/team-notes',icon: MessageSquare,  label: 'Notas' },
  { to: '/clientes',  icon: Users,          label: 'Clientes' },
];

function LeftSidebar() {
  const location = useLocation();

  return (
    <aside className="lsb-root">
      <div className="lsb-brand">
        <img
          src="https://ik.imagekit.io/arielgenua/ChatGPT%20Image%206%20abr%202026,%2005_54_51%20p.m..png"
          alt="Mbarete"
          className="lsb-logo"
        />
        <span className="lsb-brand-name">Mbarete</span>
      </div>

      <nav className="lsb-nav">
        <span className="lsb-section-label">Accesos rápidos</span>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to ||
            (to === '/home' && location.pathname === '/');
          return (
            <Link
              key={to}
              to={to}
              className={`lsb-item${isActive ? ' lsb-item--active' : ''}`}
            >
              <Icon size={18} className="lsb-item-icon" />
              <span className="lsb-item-label">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default LeftSidebar;
