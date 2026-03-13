import './styles.css';

function PaymentNavbar() {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleDateString('es-ES', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const paymentAmount = '260000';

  return (
    <div className="payment-navbar">
      <div className="payment-navbar__content">
        <div className="payment-navbar__date">
          <div className="payment-navbar__month">{currentMonth}</div>
          <div className="payment-navbar__year">{currentYear}</div>
        </div>
        
        <div className="payment-navbar__payment">
          <div className="payment-navbar__label">A pagar</div>
          <div className="payment-navbar__amount">
            <span className="payment-navbar__currency">ARS</span>
            <span className="payment-navbar__value">${paymentAmount}</span>
          </div>
        </div>
        
        <div className="payment-navbar__accent"></div>
      </div>
    </div>
  );
}

export default PaymentNavbar;