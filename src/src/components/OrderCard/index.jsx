/* eslint-disable react/prop-types */
import { useState } from 'react';
import './styles.css';
import { useOrder } from '../../hooks/useOrder';
import { useNavigate } from 'react-router-dom';

const OrderCard = ({ product, quantity, selectedVariants, onImageClick, isMeli }) => {
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const { deleteItem } = useOrder()

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const DeleteConfirmationModal = ({ show, onClose }) => {
    if (!show) return null;

    return (
      <div style={styles.modalBackground}>
        <div style={styles.modalContainer}>
          <h2 style={styles.modalText}>Item eliminado</h2>
        </div>
      </div>
    );
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      // Crear el item completo con producto y variantes para eliminar específicamente esta combinación
      const itemToDelete = {
        product: product,
        selectedVariants: selectedVariants
      };
      deleteItem(itemToDelete);
      setShowModal(true); // Muestra el modal

      // Cierra el modal después de 2 segundos
    }
  };


  const styles = {
    modalBackground: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContainer: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '10px',
      textAlign: 'center',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    },
    modalText: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#333',
    },
  };
  console.log(product)


  return (
    <div className="cart-order-card">
      <div className="cart-card-header">
        <h3 className="cart-card-title">{product.name}</h3>
        <span className="cart-product-code">{product.productCode}</span>
      </div>

      <div className="cart-card-content" style={{ flexDirection: 'column', height: 'auto' }}>
        {product.imageUrl && (
          <div
            className="cart-product-image-container"
            onClick={() => onImageClick && onImageClick(product.imageUrl)}
            style={{
              width: '100%',
              height: '150px',
              marginBottom: '10px',
              borderRadius: '8px',
              overflow: 'hidden',
              cursor: 'zoom-in'
            }}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}
        <div className="cart-info-grid">
          <div className="cart-info-item">
            <span className="cart-info-label">Detalles</span>
            <span className="cart-info-value">{product.details || 'Sin detalles'}</span>
          </div>
          <div className="cart-info-item">
            <span className="cart-info-label">Cantidad</span>
            <span className="cart-info-value">{quantity}</span>
          </div>
          <div className={`cart-info-item ${product.stock < 10 ? 'stock-low' : 'stock-good'}`}>
            <span className="cart-info-label">Stock Disp.</span>
            <span className="cart-info-value">{product.stock}</span>
          </div>
          {selectedVariants?.color && (
            <div className="cart-info-item">
              <span className="cart-info-label">Color</span>
              <span className="cart-info-value">{selectedVariants.color}</span>
            </div>
          )}
          {selectedVariants?.size ? (
            <div className="cart-info-item">
              <span className="cart-info-label">Talle</span>
              <span className="cart-info-value">{selectedVariants.size}</span>
            </div>
          ) : product.sizes && product.sizes.length > 0 && (
            <div className="cart-info-item">
              <span className="cart-info-label">Talles</span>
              <span className="cart-info-value">{product.sizes.join(', ')}</span>
            </div>
          )}
          <div className="cart-info-item">
            <span className="cart-info-label">
              {isMeli ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ background: '#FFE600', color: '#333', fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px' }}>meli</span>
                  Precio
                </span>
              ) : 'Precio'}
            </span>
            <span className="cart-info-value">
              ${isMeli ? (product.meliPrice ?? product.price) : product.price}
            </span>
          </div>
          <div className="cart-info-item cart-total">
            <span className="cart-info-label">Total</span>
            <span className="cart-info-value">
              ${((isMeli ? (product.meliPrice ?? product.price) : product.price) * quantity).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="cart-card-actions">
        <button className="cart-modify-button" onClick={() => {
          const params = new URLSearchParams({
            'in-cart': 'true'
          });
          if (selectedVariants?.size) params.append('size', selectedVariants.size);
          if (selectedVariants?.color) params.append('color', selectedVariants.color);
          navigate(`/select-product-amount/${product.id}?${params.toString()}`);
        }}>
          Modificar
        </button>
        <button className="cart-delete-button" onClick={handleDelete}>
          Eliminar del pedido
        </button>
      </div>

      <div className="cart-card-footer">
        <span className="cart-update-date">Actualizado: {formatDate(product.updatedAt)}</span>
      </div>
    </div>
  );


};

export default OrderCard;