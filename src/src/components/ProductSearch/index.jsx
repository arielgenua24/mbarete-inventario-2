import { useState, useEffect, useCallback } from "react";
import PropTypes from 'prop-types';
import { useNavigate } from "react-router-dom";
import EditProductBtn from "../EditProduct";
import QRButton from "../QrGenerateBtn";
import ImageModal from "../ImageModal";
import { Search, Package, Loader2, ShoppingCart } from "lucide-react";
import useProducts from "../../hooks/useProducts";
import { useOrder } from "../../hooks/useOrder";
import './styles.css';

function ProductSearch({ setQRcode, isCartEnabled }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);

  const navigate = useNavigate();
  const { searchProductsByNameOrCode } = useProducts();
  const { addItem } = useOrder();

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const debounceTimer = setTimeout(async () => {
      try {
        const results = await searchProductsByNameOrCode(searchTerm);
        setSearchResults(results);

        // Initialize quantities for all results
        const initialQuantities = {};
        results.forEach(product => {
          if (!quantities[product.id]) {
            initialQuantities[product.id] = 1;
          }
        });
        setQuantities(prev => ({ ...prev, ...initialQuantities }));
      } catch (error) {
        console.error("Error en la búsqueda de productos:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Faster debounce for snappier feel

    return () => clearTimeout(debounceTimer);

  }, [searchTerm, searchProductsByNameOrCode]);

  const clearSearch = () => {
    setSearchTerm("");
    setIsFocused(false);
    setSearchResults([]);
    setQuantities({});
  };

  const handleQuantityChange = useCallback((productId, delta, maxStock) => {
    setQuantities(prev => {
      const current = prev[productId] || 1;
      const newQuantity = current + delta;

      // Clamp between 1 and available stock
      if (newQuantity < 1) return prev;
      if (newQuantity > maxStock) return prev;

      return { ...prev, [productId]: newQuantity };
    });
  }, []);

  const handleAddToCart = useCallback((product) => {
    const quantity = quantities[product.id] || 1;

    // Add to cart using the order context
    addItem({
      product: product,
      quantity: quantity,
      selectedVariants: {
        size: product.size || null,
        color: product.color || null
      }
    });

    // Reset quantity for this product after adding
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));

    // Clear search to show confirmation implicitly
    // User can continue searching or go to cart manually
  }, [quantities, addItem]);

  const handleDirectAdd = useCallback((productId) => {
    // Navigate to the amount selection page for more options
    navigate(`/select-product-amount/${productId}`);
  }, [navigate]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // Determine if search is active (focused with results showing)
  const isSearchActive = isFocused && searchTerm;

  return (
    <>
      {/* Backdrop overlay to dim rest of page when search is active */}
      <div
        className={`search-backdrop ${isSearchActive ? 'visible' : ''}`}
        onClick={clearSearch}
      />

      <div className={`product-search-container ${isSearchActive ? 'active' : ''}`}>
        {/* Image Modal for large view */}
        <ImageModal
          isOpen={!!selectedImage}
          imageSrc={selectedImage}
          onClose={() => setSelectedImage(null)}
        />

        {/* Search Header */}
        <div className="product-search-header">
          <div className={`search-wrapper ${isFocused ? 'focused' : ''}`}>
            <Search className="search-icon" size={22} />
            <input
              className="search-input"
              type="text"
              placeholder="Buscar por nombre o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => { if (!searchTerm) setIsFocused(false); }, 150)}
            />
            {searchTerm && (
              <button
                className="clear-search-btn"
                onClick={clearSearch}
                aria-label="Limpiar búsqueda"
              >
                <span aria-hidden="true">X</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Container */}
        <div className={`results-container ${isSearchActive ? 'visible' : ''}`}>
          {isSearching ? (
            <div className="searching-indicator">
              <Loader2 className="animate-spin" size={24} />
              <span>Buscando...</span>
            </div>
          ) : searchResults.length === 0 && searchTerm ? (
            <div className="no-results">
              <Package size={48} />
              <span>No se encontraron productos para "{searchTerm}"</span>
            </div>
          ) : (
            <ul className="results-list">
              {searchResults.map((product) => {
                const currentQuantity = quantities[product.id] || 1;
                const availableStock = Math.max(0, product.stock || 0);
                const isOutOfStock = availableStock <= 0;

                return (
                  <li
                    key={product.id}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`result-item ${product.stock <= 0 ? 'low-stock' : ''}`}
                  >
                    {/* Product Info Row */}
                    <div className="product-info-actions-container">
                      {/* Product Image */}
                      <div
                        className="search-product-image-container"
                        onClick={() => product.imageUrl && setSelectedImage(product.imageUrl)}
                        style={{ cursor: product.imageUrl ? 'zoom-in' : 'default' }}
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="search-product-image"
                            loading="lazy"
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Package size={32} color="#8696a0" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="product-info-content">
                        <div className="product-info">
                          <h3 className="product-name">{product.name}</h3>
                        </div>

                        <div className="search-product-details">
                          {product.color && <span>Color: {product.color}</span>}
                          {product.size && <span>Talle: {product.size}</span>}
                          <span>#{product.productCode}</span>
                        </div>

                        <span className="product-price">{formatPrice(product.price)}</span>

                        <span className={`stock-indicator ${product.stock <= 10 ? 'warning' : 'good'}`}>
                          {isOutOfStock ? 'Sin stock' : `${product.stock} disponibles`}
                        </span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="product-actions">
                      {/* Cart Mode - Quantity Selector + Add Button */}
                      {isCartEnabled && (
                        <div className="cart-quick-action">
                          {/* Quantity Selector */}
                          <div className="quantity-selector">
                            <button
                              className="quantity-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuantityChange(product.id, -1, availableStock);
                              }}
                              disabled={currentQuantity <= 1 || isOutOfStock}
                              aria-label="Reducir cantidad"
                            >
                              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#111B21' }}>-</span>
                            </button>

                            <span className="quantity-display">{currentQuantity}</span>

                            <button
                              className="quantity-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuantityChange(product.id, 1, availableStock);
                              }}
                              disabled={currentQuantity >= availableStock || isOutOfStock}
                              aria-label="Aumentar cantidad"
                            >
                              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#111B21' }}>+</span>
                            </button>
                          </div>

                          {/* Add to Cart Button */}
                          <button
                            className="search-add-to-cart-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
                            disabled={isOutOfStock}
                            style={{ opacity: isOutOfStock ? 0.5 : 1 }}
                          >
                            <ShoppingCart size={18} />
                            {isOutOfStock ? 'Sin stock' : 'Agregar'}
                          </button>
                        </div>
                      )}

                      {/* Inventory Mode - Edit/QR Buttons */}
                      {!isCartEnabled && (
                        <div className="inventory-actions">
                          <EditProductBtn product_id={product.id} />
                          <QRButton
                            product={product}
                            onQRGenerate={() => setQRcode(product)}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

ProductSearch.propTypes = {
  setQRcode: PropTypes.func,
  isCartEnabled: PropTypes.bool
};

ProductSearch.defaultProps = {
  setQRcode: () => { },
  isCartEnabled: false
};

export default ProductSearch;
