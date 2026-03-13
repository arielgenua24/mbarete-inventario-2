import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import './styles.css';

const AIResultsModal = ({ isOpen, onClose, savedProducts }) => {
  const navigate = useNavigate();

  if (!isOpen || !savedProducts?.length) return null;

  const handleEdit = (productId) => {
    onClose();
    navigate(`/product/${productId}`);
  };

  return (
    <div className="air-overlay" onClick={onClose}>
      <div className="air-dialog" onClick={(e) => e.stopPropagation()}>

        <div className="air-drag-wrap">
          <div className="air-drag-handle" />
        </div>

        <div className="air-header">
          <div className="air-header-text">
            <span className="air-badge">✦ IA</span>
            <h2 className="air-title">{savedProducts.length} productos guardados</h2>
            <p className="air-subtitle">Tocá Editar en cada uno para agregar la foto y detalles finales.</p>
          </div>
          <button className="air-close" onClick={onClose}>✕</button>
        </div>

        <div className="air-list">
          {savedProducts.map((product) => (
            <div key={product.id} className="air-item">
              <div className="air-item-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div className="air-item-info">
                <span className="air-item-name">{product.name}</span>
                <span className="air-item-meta">
                  ${product.price?.toLocaleString('es-AR')}
                  {product.sizes?.length > 0 && ` · Talle ${product.sizes[0]}`}
                  {product.category && ` · ${product.category}`}
                </span>
              </div>
              <button
                className="air-edit-btn"
                onClick={() => handleEdit(product.id)}
              >
                Editar
              </button>
            </div>
          ))}
        </div>

        <div className="air-footer">
          <button className="air-done-btn" onClick={onClose}>
            Listo
          </button>
        </div>

      </div>
    </div>
  );
};

AIResultsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  savedProducts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    price: PropTypes.number,
    sizes: PropTypes.array,
    category: PropTypes.string,
  })),
};

export default AIResultsModal;
