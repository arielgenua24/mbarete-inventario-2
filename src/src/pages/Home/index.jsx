import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useOrder } from '../../hooks/useOrder';
import { ShoppingCart, List, MessageSquare, Users, ChevronDown } from 'lucide-react';
import useFirestoreContext from '../../hooks/useFirestoreContext';
import LoadingComponent from '../../components/Loading';
import { forceSync } from '../../services/syncScheduler';
import './styles.css';

function Home() {
    const { order, setOrder, getCustomerData } = useOrder();
    const { user, getAdmin } = useFirestoreContext();
    const [loadingAdmin, setLoadingAdmin] = useState(false);
    const [admin, setAdmin] = useState(null);
    const [showWelcome, setShowWelcome] = useState(true);
    const welcomeRef = useRef(null);

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

        const checkAdmin = async () => {
            setLoadingAdmin(true);
            const adminData = await getAdmin();
            setAdmin(adminData);
            setLoadingAdmin(false);
        };

        checkAdmin();

        console.log('🏠 Home mounted - forcing immediate sync (no rate limit)...');
        forceSync().then(() => {
            console.log('✅ Force sync completed on Home');
        }).catch(err => {
            console.error('❌ Force sync failed:', err);
        });
    }, []);

    useEffect(() => {
        if (!showWelcome) return;
        const node = welcomeRef.current;
        if (!node) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
                    setShowWelcome(false);
                }
            },
            { root: null, rootMargin: '0px', threshold: 0 }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [showWelcome]);

    const areProductsInOrder = order.products.length;

    /* Placeholder LLM notification — will be replaced with real AI analysis later */
    const llmNotifications = {
        count: 3,
        message: "Hay 2 productos con stock bajo y 1 pedido pendiente de ayer."
    };

    return (
        <div className="home-page">
            <LoadingComponent isLoading={loadingAdmin} />

            {/* ========== WELCOME SECTION (top 40vh) ========== */}
            {showWelcome && (
                <div
                    ref={welcomeRef}
                    className="welcome-section"
                >
                    <div className="welcome-content">
                        <h1 className="welcome-title">
                            Bienvenida a tu sistema de inventario
                        </h1>

                        <div className="welcome-main">
                            <div className="welcome-icon-placeholder">
                                <img
                                    src="https://ik.imagekit.io/arielgenua/Gemini_Generated_Image_7e70kd7e70kd7e70-removebg-preview.png"
                                    alt="Bienvenida"
                                    className="welcome-icon-img"
                                />
                            </div>

                            <div className="welcome-info">
                                <div className="welcome-greeting-row">
                                    <span className="welcome-greeting">Hola Majo!</span>
                                    <div className="welcome-badge">
                                        {llmNotifications.count}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        className="welcome-scroll-indicator"
                        onClick={() => window.scrollTo({ top: window.innerHeight * 0.4, behavior: 'smooth' })}
                    >
                        <span>Desliza hacia abajo para ir a tu inventario</span>
                        <ChevronDown size={20} className="bounce-arrow" />
                    </button>
                </div>
            )}

            {/* ========== HOME CONTENT ========== */}
            <div className="home-content">

                <div className="home-container">

                    {/* --- Dinero y notificaciones (Kyle UI card) --- */}
                    {user && (
                        <Link to="/inbox" className="home-link">
                            <div className="home-card dinero-card">
                                <div className="card-icon-area">
                                    <img src="https://ik.imagekit.io/arielgenua/monet.png" alt="dinero" className="card-icon-img" />
                                </div>
                                <div className="card-text">
                                    <span className="card-title">Dinero y notificaciones</span>
                                    <span className="card-subtitle">Revisar dinero recibido y avisos</span>
                                </div>
                            </div>
                        </Link>
                    )}

                    {/* --- Orders Section — dashed blue border --- */}
                    <div className="orders-dashed-container">
                        <div className="dashed-icon-area">
                            <img src="https://ik.imagekit.io/arielgenua/Gemini_Generated_Image_i6o8q9i6o8q9i6o8-removebg-preview.png" alt="pedidos" className="card-icon-img" />
                        </div>

                        <div className="orders-list">
                            <Link to="/new-order" className="home-link-inner">
                                <div className="order-item">
                                    <ShoppingCart size={18} className="order-item-icon" />
                                    <div className="order-item-text">
                                        <span className="card-title">
                                            {!areProductsInOrder
                                                ? 'Nuevo Pedido'
                                                : `Continuar el pedido de ${customerData.customerName}`}
                                        </span>
                                        <span className="card-subtitle">
                                            Crea o continúa un nuevo pedido
                                        </span>
                                    </div>
                                </div>
                            </Link>

                            <div className="order-divider" />

                            <Link to="/orders" className="home-link-inner">
                                <div className="order-item">
                                    <List size={18} className="order-item-icon" />
                                    <div className="order-item-text">
                                        <span className="card-title">Pedidos</span>
                                        <span className="card-subtitle">
                                            Órdenes pendientes de los clientes
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* --- Catálogo (Kyle UI card) --- */}
                    <Link to="/inventory" className="home-link">
                        <div className="home-card catalog-card">
                            <div className="card-icon-area">
                                <img src="https://ik.imagekit.io/arielgenua/Gemini_Generated_Image_usm6fbusm6fbusm6-removebg-preview.png" alt="catálogo" className="card-icon-img" />
                            </div>
                            <div className="card-text">
                                <span className="card-title">Catálogo</span>
                                <span className="card-subtitle">
                                    Agrega tus productos y controla tu stock
                                </span>
                            </div>
                        </div>
                    </Link>

                    {/* --- Otras acciones (Notas + Clientes) --- */}
                    <div className="other-actions-container">
                        <span className="other-actions-label">Otras acciones</span>

                        <div className="other-actions-grid">
                            <Link to="/team-notes" className="other-action-link">
                                <div className="other-action-item">
                                    <MessageSquare size={20} />
                                    <span>Notas</span>
                                </div>
                            </Link>

                            <Link to="/clientes" className="other-action-link">
                                <div className="other-action-item">
                                    <Users size={20} />
                                    <span>Clientes</span>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
