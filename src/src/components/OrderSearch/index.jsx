import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Filter } from "lucide-react";
import searchOrders from "../../utils/searchOrder";
import QRButton from "../QrGenerateBtn";
import QRmodal from "../../modals/Qrmodal";
import './styles.css'


function OrderSearch({ orders, isActionEnabled }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [QRcode, setQRcode] = useState("");
  const navigate = useNavigate();

  const [activeFilters, setActiveFilters] = useState({
    readyToDispatch: false
  });

  const filteredOrders = useMemo(() => {
    // When no search term, start from all orders
    let result = searchTerm.trim()
      ? searchOrders(orders, searchTerm)
      : (orders || []);

    if (activeFilters.readyToDispatch) {
      result = result.filter(order => {
        const estado = (order?.estado ?? order?.status ?? '').toLowerCase();
        return estado === "listo para despachar";
      });
    }

    return result;
  }, [orders, searchTerm, activeFilters]);

  const clearSearch = () => {
    setSearchTerm("");
    setIsFocused(false);
  };

  const toggleFilter = (filterKey) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterKey]: !prev[filterKey]
    }));
  };

  // Show results only when there is an active query or filter
  const hasSearchTerm = Boolean(searchTerm.trim());
  const showResults = hasSearchTerm || activeFilters.readyToDispatch;
  const displayedOrders = showResults ? filteredOrders : [];

  return (
    <div className="order-search-container">
      <div className="search-header">
        <div className={`search-wrapper ${isFocused ? 'focused' : ''}`}>
          <Search className="search-icon" size={20} />
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por cliente, dirección, teléfono, código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => !searchTerm && setIsFocused(false)}
          />
          {searchTerm && (
            <button
              className="clear-search-btn"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="filter-controls">
          <button
            className={`filter-btn ${activeFilters.readyToDispatch ? 'active' : ''}`}
            onClick={() => toggleFilter('readyToDispatch')}
          >
            <Filter size={16} /> Listos para despachar
          </button>
        </div>
      </div>

      <div className={`results-container ${showResults ? 'visible' : ''}`}>
        {showResults && displayedOrders.length === 0 ? (
          <div className="no-results">
            {searchTerm.trim()
              ? `No se encontraron órdenes para "${searchTerm}"`
              : 'No se encontraron órdenes'}
          </div>
        ) : showResults ? (
          <ul className="results-list">
            {displayedOrders.map((order) => {
              const status = (order?.estado ?? order?.status ?? "sin estado").toString();
              const statusClassName = status.toLowerCase().replace(/\s+/g, "-");

              return (
                <li
                  key={order.id}
                  className={`result-item ${status === "listo para despachar" ? "ready-to-dispatch" : ""}`}
                >
                  <div className="order-info">
                    <h3 className="order-code">{order.orderCode}</h3>
                    <div className="search-order-details">
                      <span>Cliente: {order.cliente}</span>
                      <span>Dirección: {order.direccion}</span>
                      <span>Teléfono: {order.telefono}</span>
                      <span>Fecha: {order.fecha}</span>
                      <span className={`status-indicator ${statusClassName}`}>
                        Estado: {status}
                      </span>
                    </div>
                  </div>
                  <div className="order-actions">
                    {isActionEnabled && (
                      <>
                       <QRButton
                        product={order}
                        onQRGenerate={setQRcode}
                      />
                        <button
                          className="verify-button"
                          onClick={() => navigate(`/ProductsVerification/${order.id}/?orderEstado=${status}`)}
                        >
                          Verificar Productos
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {QRcode && (
      <QRmodal
      QRcode={QRcode}
      setQRcode={setQRcode}
      orderCode={true}
      />
  )}
    </div>

  );
}

export default OrderSearch;
