import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useLocalOrders from '../../hooks/useLocalOrders';
import checkIcon from '../../assets/icons/icons8-check-96.png';
import ClientShareActions from '../../components/ClientShareActions';
import './styles.css';


function SuccededOrder() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { getOrderById } = useLocalOrders();
    const [orderData, setOrderData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                console.log('📦 Fetching order from IndexedDB:', id);
                const data = await getOrderById(id);
                console.log('📦 Order data:', data);
                setOrderData(data);
            } catch (error) {
                console.error('❌ Error fetching order:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchOrder();
        }
    }, [id, getOrderById]);

    if (isLoading) {
        return (
            <div style={{
                marginTop: '20px',
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif'
            }}>
                <p>Cargando pedido...</p>
            </div>
        );
    }

    if (!orderData) {
        return (
            <div style={{
                marginTop: '20px',
                textAlign: 'center',
                fontFamily: 'Arial, sans-serif'
            }}>
                <p>No se encontró el pedido</p>
                <button onClick={() => navigate('/orders')} style={{
                    backgroundColor: '#0E6FFF',
                    color: 'white',
                    border: 'none',
                    padding: '15px 30px',
                    borderRadius: '20px',
                    fontSize: '16px',
                    marginTop: '20px'
                }}>
                    IR A PEDIDOS
                </button>
            </div>
        );
    }

    return (
        <div style={{
          marginTop: '20px',
          fontFamily: 'Arial, sans-serif',
          paddingBottom: '80px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
           <img src={checkIcon} alt="Check icon"
            style={{
              width: '47px',
              height: '47px',
            }}

           />
            <h1 style={{
              color: '#333',
              fontSize: '24px',
              margin: 0
            }}>
              LISTO!
            </h1>
          </div>

          <h2 style={{
            color: '#666',
            fontSize: '16px',
            marginBottom: '20px',
            marginTop: '75px',
            textAlign: 'center',
            padding: '0 20px'
          }}>
            {orderData.syncStatus === 'synced'
              ? 'Pedido creado y sincronizado exitosamente'
              : 'Pedido creado. Se sincronizará automáticamente cuando haya conexión.'}
          </h2>

          {/* Código del pedido */}
          <div className="order-code-card">
            <span className="order-code-label">Código del pedido</span>
            <span className="order-code-value">{orderData.orderCode}</span>
          </div>

          {/* Sección para compartir con el cliente */}
          <ClientShareActions order={orderData} variant="full" />

          <button
          onClick={() => {
            navigate('/orders');
          }}
          className="go-to-orders-btn">
            OK, IR A PEDIDOS
          </button>

        </div>
      );
}

export default SuccededOrder;