/* eslint-disable react/prop-types */
import React from 'react';
import './styles.css';

const ProductVerificationStatus = ({ orderStatus, product, verifiedProducts, setVerifiedProducts }) => {
  // Función para calcular el porcentaje de verificación
  const calculateVerificationProgress = () => {
    if(orderStatus === 'listo para despachar') return 100;


    if (!product.stock) return 0;
    return Math.round((product.verified / product.stock) * 100);
  };

  // Función para determinar el estado y mensaje
  const getVerificationStatus = () => {
    if (!product.stock) {
      return {
        message: "No hay stock registrado",
        className: "status-warning",
        icon: "⚠️"
      };
    }

    const progress = calculateVerificationProgress();

    if (progress === 100) {
      if(!product.counted) {
        setVerifiedProducts(verifiedProducts + 1);
        product.counted = true;
      }
      
      return {
        message: "Producto listo para despachar",
        className: "status-success",
        icon: "✅"
      };
    } else if (progress > 0) {
      return {
        message: `Verificación en progreso: ${product.verified} de ${product.stock} unidades`,
        className: "status-progress",
        icon: "🔄"
      };
    } else {
      return {
        message: "Pendiente de verificación",
        className: "status-pending",
        icon: "⏳"
      };
    }
  };

  const status = getVerificationStatus();

  return (
    <div className={`verification-status ${status.className}`}>
      <span className="status-icon">{status.icon}</span>
      <h2>{status.message}</h2>
      {product.stock > 0 && (
        <div className="progress-bar-container">
          <div 
            className="progress-bar"
            style={{ width: `${calculateVerificationProgress()}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ProductVerificationStatus;