import { useNavigate, useLocation } from 'react-router-dom'
import { IoArrowBack } from "react-icons/io5"
import { useOrder } from '../../hooks/useOrder';
import { useState, useEffect } from 'react';
import cartIcon from '../../assets/icons/icons8-trolley-94.png'
import './styles.css'


function BackNav() {
  const [cartCount, setCartCount] = useState(0)

    const navigate = useNavigate();
    const location = useLocation();

    const { cart } = useOrder(); // obtenemos findItems del localStorage

    useEffect(() => {
      // Actualizar el contador cuando cambie finditems en el localStorage
      if (cart) {
        setCartCount(cart.length);
        console.log(cart.length)
      }
    }, [cart]);


    const navStyle = {
      height: '44px',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px', 
      borderBottom: '1px solid #e0e0e0', 
    };

    const availablePaths = {
      '/select-products': 'Seleccionar Productos',
      'select-product-amount': 'Cantidad de Productos',
    };
    
    // Hide navbar on public customer-facing routes and login
    if (location.pathname.startsWith('/mi-compra')) {
        return null;
    }

    if(location.pathname !== '/' && location.pathname !== '/home') {
        return (
            <nav style={navStyle}>
              <button 
                onClick={() => navigate('/home')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <IoArrowBack size={24} />
              </button>

                { location.pathname in availablePaths && (
                    <div className="relative">
                    <button 
                      onClick={() => navigate('/cart')} 
                      className="cart-button">
                      <img
                        src={cartIcon}
                        alt="Cart"
                        width={30}
                        height={30}
                      />
                      <span>
                        CONTROL
                      </span>
                      {cartCount > 0 && (
                        <div className="cart-count">
                          {cartCount}
                        </div>
                      )}
                    </button>
                  </div>
                ) }

              

            </nav>
          ) 
    }

   
}

export default BackNav;