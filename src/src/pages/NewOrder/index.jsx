import  { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrder } from '../../hooks/useOrder';
import './styles.css';

const NewOrder = () => {
  const { order, setOrder, clearCustomerData, setCart } = useOrder();
  const [customerData, setCustomerData] = useState({
    customerName: order.customerName || '',
    phone: order.phone || '',
    address: order.address || '',
  });

  const navigate = useNavigate();
  console.log(order.products.length)


  const handleChange = (e) => {
    setCustomerData({ ...customerData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    setOrder({ ...order, ...customerData }); // Guardar datos en el contexto
    navigate('/select-products'); // Navegar a la siguiente ventana
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
    </div>
  );
};

export default NewOrder;
