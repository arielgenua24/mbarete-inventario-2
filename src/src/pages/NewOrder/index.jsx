import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrder } from '../../hooks/useOrder';
import useIsAdmin from '../../hooks/useIsAdmin';
import './styles.css';

const MeliModal = ({ onConfirm, onDeny }) => (
  <div className="meli-modal-overlay">
    <div className="meli-modal">
      <div className="meli-modal-header">
        <span className="meli-modal-logo">meli+</span>
        <p className="meli-modal-tagline">Mercado Libre</p>
      </div>
      <p className="meli-modal-question">
        Majo, ¿esta venta tendrá los precios de Mercado Libre?
      </p>
      <div className="meli-modal-actions">
        <button className="meli-modal-btn meli-modal-btn--yes" onClick={onConfirm}>
          Sí, es de Meli
        </button>
        <button className="meli-modal-btn meli-modal-btn--no" onClick={onDeny}>
          No, precio normal
        </button>
      </div>
    </div>
  </div>
);

const NewOrder = () => {
  const { order, setOrder, clearCustomerData, setCart, setIsMeli } = useOrder();
  const { isAdmin } = useIsAdmin();
  const [customerData, setCustomerData] = useState({
    customerName: order.customerName || '',
    phone: order.phone || '',
    address: order.address || '',
  });
  const [showMeliModal, setShowMeliModal] = useState(false);

  const navigate = useNavigate();
  console.log(order.products.length)

  const handleChange = (e) => {
    setCustomerData({ ...customerData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    setOrder({ ...order, ...customerData });
    if (!isAdmin) {
      setIsMeli(false);
      navigate('/select-products');
      return;
    }
    setShowMeliModal(true);
  };

  const handleMeliConfirm = () => {
    setIsMeli(true);
    setShowMeliModal(false);
    navigate('/select-products');
  };

  const handleMeliDeny = () => {
    setIsMeli(false);
    setShowMeliModal(false);
    navigate('/select-products');
  };

  const handleClearData = () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      setCart([])
      clearCustomerData();
      setCustomerData({
        customerName: '',
        phone: '',
        address: '',
      });
      setOrder({
        customerName: '',
        phone: '',
        address: '',
        products: [],
      });
      localStorage.clear('cart-r-v1.1');
      console.log('pedido eliminado')
      console.log(JSON.parse(localStorage.getItem('cart-r-v1.1')))
    }
  };

  const areProductsInOrder = order.products.length
  console.log(areProductsInOrder)

  return (
    <div className="order-form-container">
      {!areProductsInOrder ?
        (<h2 className="order-form-title">Nuevo Pedido</h2>) :
        (<h2 className="order-form-title">Continuar el pedido de: {customerData.customerName}</h2>)
      }
      <span className="order-form-label"> Revise los datos del cliente:</span>

      <input
        className="order-form-input"
        type="text"
        name="customerName"
        placeholder="Nombre del cliente"
        value={customerData.customerName}
        onChange={handleChange}
      />
      <input
        className="order-form-input"
        type="text"
        name="phone"
        placeholder="Teléfono"
        value={customerData.phone}
        onChange={handleChange}
      />
      <input
        className="order-form-input"
        type="text"
        name="address"
        placeholder="Dirección"
        value={customerData.address}
        onChange={handleChange}
      />
      <div className="order-form-buttons">
        <button
          className="order-form-clear-btn"
          onClick={handleClearData}>
          Eliminar pedido
        </button>

        <button
          className="order-form-next-btn"
          onClick={handleNext}>
          Siguiente
        </button>
      </div>

      {showMeliModal && (
        <MeliModal onConfirm={handleMeliConfirm} onDeny={handleMeliDeny} />
      )}
    </div>
  );
};

export default NewOrder;
