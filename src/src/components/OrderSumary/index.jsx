/* eslint-disable react/prop-types */
// OrderSummary.js
import './styles.css';

const OrderSummary = ({ order, cart }) => {
    console.log(order)
  return (
    <div className="order-summary-container">
      <div className="order-summary-header">
        <h1 className="order-summary-title">Resumen de la Orden</h1>
      </div>
      
      <div className="order-details">
        <div className="customer-info">
          <h2>Datos del Cliente</h2>
          <div className="info-row">
            <span className="info-label">Cliente:</span>
            <span className="info-value">{order.customerName || 'No especificado'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Teléfono:</span>
            <span className="info-value">{order.phone || 'No especificado'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Dirección:</span>
            <span className="info-value">{order.address || 'No especificada'}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrderSummary;