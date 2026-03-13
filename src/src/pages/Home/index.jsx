import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOrder } from '../../hooks/useOrder';
import { Inbox, ShoppingCart, List, Package, MessageSquare } from 'lucide-react';
import useFirestoreContext from '../../hooks/useFirestoreContext';
import LoadingComponent from '../../components/Loading';
import PaymentNavbar from '../../components/PaymentNavbar';
import ParticlesBackground from '../../components/ParticlesBackground';
import { forceSync } from '../../services/syncScheduler';
import './styles.css';

function Home() {
    const { order, setOrder, getCustomerData } = useOrder();
    const { user, getAdmin } = useFirestoreContext();
    const [loadingAdmin, setLoadingAdmin] = useState(false) // Estado para controlar la carga de admin
    const [admin, setAdmin] = useState(null); // Inicializamos admin como null o un valor que indique 'cargando'



    const [customerData, setCustomerData] = useState({
        customerName: order.customerName || '',
        phone: order.phone || '',
        address: order.address || '',
    });

    useEffect(() => {
        let data = getCustomerData();
        if (data.customerName !== '') {
            setOrder(data);
            setCustomerData(data);
        }

        const checkAdmin = async () => { // Función asíncrona para manejar la promesa
            setLoadingAdmin(true); // Iniciamos la carga de admin
            const adminData = await getAdmin(); // Esperamos a que la promesa se resuelva
            setAdmin(adminData); // Establecemos el estado admin con el valor resuelto
            setLoadingAdmin(false); // Finaliza la carga de admin
        };

        checkAdmin();

        // FORCE sync in background when user lands on Home (bypasses rate limiting)
        // This ensures IndexedDB ALWAYS has latest products from Firestore
        // Critical for scenarios like:
        // - Admin changes stock in Firestore → User needs fresh data
        // - Multiple devices updating inventory
        console.log('🏠 Home mounted - forcing immediate sync (no rate limit)...');
        forceSync().then(() => {
            console.log('✅ Force sync completed on Home');
        }).catch(err => {
            console.error('❌ Force sync failed:', err);
        });

    }, []);

    const areProductsInOrder = order.products.length;

    return (
        <div className="home-page">
            <ParticlesBackground />
            <LoadingComponent isLoading={loadingAdmin} />
            <PaymentNavbar />
            <div className="home-container">
                <h2 className="home-welcome-text">
                    Bienvenida a tu sistema de inventario Majo
                </h2>


        {admin && admin === user && ( <Link to="/inbox" className="home-link">
                <button className="home-btn inbox">
                    <Inbox size={24} className="home-icon" />
                    Dinero y notificaciones
                    <span className="home-subtext">Revisar dinero recibido y avisos</span>
                </button>
            </Link>)}
           

            <div className="home-orders-section">
                <Link to="/new-order" className="home-link">
                    <button className="home-btn order">
                        <ShoppingCart size={24} className="home-icon" />
                        {!areProductsInOrder ? 'Nuevo Pedido' : `Continuar el pedido de ${customerData.customerName}`}
                        <span className="home-subtext">Crea o continúa un nuevo pedido</span>
                    </button>
                </Link>

                <Link to="/orders" className="home-link">
                    <button className="home-btn order">
                        <List size={24} className="home-icon" />
                        Pedidos
                        <span className="home-subtext">Órdenes pendientes de los clientes</span>
                    </button>
                </Link>
            </div>

                <Link to="/inventory" className="home-link">
                    <button className="home-btn catalog">
                        <Package size={24} className="home-icon" />
                        Catálogo
                        <span className="home-subtext">Agrega tus productos y controla tu stock</span>
                    </button>
                </Link>

                {/* Team Notes - Communication Log */}
                <Link to="/team-notes" className="home-link">
                    <button className="home-btn notes">
                        <MessageSquare size={24} className="home-icon" />
                        Notas del Equipo
                        <span className="home-subtext">Comunicación y registro de eventos</span>
                    </button>
                </Link>
            </div>
        </div>
    );
}

export default Home;
