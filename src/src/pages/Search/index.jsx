import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowLeft, Package, Clock, Sparkles, ShoppingCart, Check, ChevronDown, ChevronUp, Plus } from "lucide-react";
import useProducts from "../../hooks/useProducts";
import { useOrder } from "../../hooks/useOrder";
import { sanitizeVariantInput } from "../../utils/inputSanitizer";
import ImageModal from "../../components/ImageModal";
import './styles.css';

function SearchPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);
    const [suggestedProducts, setSuggestedProducts] = useState([]);
    const [quantities, setQuantities] = useState({});
    const [selectedImage, setSelectedImage] = useState(null);
    const [addedProducts, setAddedProducts] = useState({});
    const [addedInThisSession, setAddedInThisSession] = useState(false);
    const [addToast, setAddToast] = useState({
        visible: false,
        productName: "",
        quantity: 0,
    });

    // Variant options state
    const [expandedOptions, setExpandedOptions] = useState({});
    const [variantInputs, setVariantInputs] = useState({});
    const [sessionVariants, setSessionVariants] = useState({});

    const inputRef = useRef(null);
    const toastTimerRef = useRef(null);

    const navigate = useNavigate();
    const { searchProductsByNameOrCode, getProductsPaginated } = useProducts();
    const { addItem, cart, updateQuantity, findItem } = useOrder();

    // Focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Load recent searches from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('recentProductSearches');
        if (saved) {
            setRecentSearches(JSON.parse(saved).slice(0, 5));
        }
    }, []);

    // Load suggested products
    useEffect(() => {
        const loadSuggested = async () => {
            try {
                const result = await getProductsPaginated(6, 0);
                setSuggestedProducts(result.products || []);
            } catch (error) {
                console.error("Error loading suggestions:", error);
            }
        };
        loadSuggested();
    }, [getProductsPaginated]);

    // Search with debounce
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

                // Initialize quantities
                const initialQuantities = {};
                results.forEach(product => {
                    if (!quantities[product.id]) {
                        initialQuantities[product.id] = 1;
                    }
                });
                setQuantities(prev => ({ ...prev, ...initialQuantities }));
            } catch (error) {
                console.error("Error searching:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 250);

        return () => clearTimeout(debounceTimer);
    }, [searchTerm, searchProductsByNameOrCode]);

    const saveRecentSearch = (term) => {
        const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentProductSearches', JSON.stringify(updated));
    };

    const clearSearch = () => {
        setSearchTerm("");
        setSearchResults([]);
        inputRef.current?.focus();
    };

    const clearAllRecent = () => {
        setRecentSearches([]);
        localStorage.removeItem('recentProductSearches');
    };

    const handleQuantityChange = useCallback((productId, delta, maxStock) => {
        // If user touches quantity again, we assume they want to add again -> reset CTA to "Agregar".
        setAddedProducts(prev => {
            if (!prev?.[productId]) return prev;
            const next = { ...prev };
            delete next[productId];
            return next;
        });

        setQuantities(prev => {
            const current = prev[productId] || 1;
            const newQuantity = Math.max(1, Math.min(current + delta, maxStock));
            return { ...prev, [productId]: newQuantity };
        });
    }, []);

    // --- Variant options handlers ---

    const toggleOptions = useCallback((productId) => {
        setExpandedOptions(prev => {
            const isCurrentlyOpen = prev[productId];
            if (!isCurrentlyOpen) {
                // Opening: initialize variant inputs empty
                setVariantInputs(p => ({
                    ...p,
                    [productId]: { size: '', color: '' }
                }));
            }
            return { ...prev, [productId]: !isCurrentlyOpen };
        });
    }, []);

    const handleVariantInputChange = useCallback((productId, field, value) => {
        setVariantInputs(prev => ({
            ...prev,
            [productId]: {
                ...(prev[productId] || { size: '', color: '' }),
                [field]: value
            }
        }));
        // Reset the "added" state for this product when user edits variant fields
        setAddedProducts(prev => {
            if (!prev?.[productId]) return prev;
            const next = { ...prev };
            delete next[productId];
            return next;
        });
    }, []);

    const handleAddAnotherVariant = useCallback((productId) => {
        // Clear variant inputs but keep panel open
        setVariantInputs(prev => ({
            ...prev,
            [productId]: { size: '', color: '' }
        }));
        // Reset quantity to 1
        setQuantities(prev => ({ ...prev, [productId]: 1 }));
        // Reset the "added" CTA state
        setAddedProducts(prev => {
            const next = { ...prev };
            delete next[productId];
            return next;
        });
    }, []);

    // --- End variant handlers ---

    const handleAddToCart = (product) => {
        const quantity = quantities[product.id] || 1;
        const isOptionsOpen = expandedOptions[product.id];

        let selectedVariants;
        if (isOptionsOpen) {
            const inputs = variantInputs[product.id] || { size: '', color: '' };
            selectedVariants = {
                size: sanitizeVariantInput(inputs.size),
                color: sanitizeVariantInput(inputs.color)
            };
        } else {
            selectedVariants = {
                size: product.size || null,
                color: product.color || null
            };
        }

        console.log('🛒 Adding to cart:', product.name, 'qty:', quantity, 'variants:', selectedVariants);

        const cartItem = {
            product: product,
            quantity: quantity,
            selectedVariants: selectedVariants
        };

        if (isOptionsOpen) {
            // When using custom variants, always addItem (accumulates if same variant exists)
            addItem(cartItem);

            // Track this variant for the session summary
            setSessionVariants(prev => ({
                ...prev,
                [product.id]: [
                    ...(prev[product.id] || []),
                    { size: selectedVariants.size, color: selectedVariants.color, quantity }
                ]
            }));

            // Reset variant inputs and quantity to defaults
            setVariantInputs(prev => ({
                ...prev,
                [product.id]: { size: '', color: '' }
            }));
            setQuantities(prev => ({ ...prev, [product.id]: 1 }));
        } else {
            // Original behavior: "last quantity wins" (override)
            const existingItem = findItem(cartItem);
            if (existingItem) {
                updateQuantity(cartItem, quantity);
            } else {
                addItem(cartItem);
            }
        }

        // Save search term
        if (searchTerm.trim()) {
            saveRecentSearch(searchTerm.trim());
        }

        // Show added feedback (sticky until quantity changes)
        setAddedProducts(prev => ({ ...prev, [product.id]: true }));
        setAddedInThisSession(true);

        // Global toast feedback
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        const variantLabel = (selectedVariants.size || selectedVariants.color)
            ? ` (${[selectedVariants.size, selectedVariants.color].filter(Boolean).join(', ')})`
            : '';
        setAddToast({
            visible: true,
            productName: (product?.name || "Producto") + variantLabel,
            quantity,
        });
        toastTimerRef.current = setTimeout(() => {
            setAddToast(prev => ({ ...prev, visible: false }));
        }, 2400);
    };

    const cartItemsCount = Array.isArray(cart) ? cart.length : 0;
    const cartUnitsCount = Array.isArray(cart)
        ? cart.reduce((acc, item) => acc + (Number(item?.quantity) || 0), 0)
        : 0;

    const formatPrice = (price) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    };

    const handleRecentClick = (term) => {
        setSearchTerm(term);
    };

    const displayProducts = searchTerm.trim() ? searchResults : suggestedProducts;
    const sectionTitle = searchTerm.trim()
        ? (isSearching ? "Buscando..." : `${searchResults.length} resultados`)
        : "Productos sugeridos";

    return (
        <div className="search-page">
            {/* A11y live region for cart feedback */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {addToast.visible ? `${addToast.productName} añadido al carrito. Cantidad: ${addToast.quantity}.` : ""}
            </div>

            {/* Image Modal */}
            <ImageModal
                isOpen={!!selectedImage}
                imageSrc={selectedImage}
                onClose={() => setSelectedImage(null)}
            />

            {/* Header */}
            <div className="search-page-header">
                <button className="search-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={24} strokeWidth={2} />
                </button>
                <h1 className="search-page-title">¿Qué buscás?</h1>
            </div>

            {/* Search Input */}
            <div className="search-input-container">
                <div className="search-input-wrapper">
                    <Search className="search-input-icon" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="search-page-input"
                        placeholder="Buscar productos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button className="search-clear-btn" onClick={clearSearch}>
                            <span aria-hidden="true">X</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Recent Searches */}
            {!searchTerm && recentSearches.length > 0 && (
                <div className="search-section">
                    <div className="search-section-header">
                        <span className="search-section-title">Búsquedas recientes</span>
                        <button className="search-clear-all" onClick={clearAllRecent}>
                            Borrar
                        </button>
                    </div>
                    <div className="recent-searches-list">
                        {recentSearches.map((term, index) => (
                            <button
                                key={index}
                                className="recent-search-item"
                                onClick={() => handleRecentClick(term)}
                            >
                                <div className="recent-search-icon">
                                    <Clock size={18} />
                                </div>
                                <span className="recent-search-text">{term}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Results / Suggestions Section */}
            <div className="search-section">
                <div className="search-section-header">
                    <span className="search-section-title">{sectionTitle}</span>
                    {!searchTerm && (
                        <Sparkles size={16} className="section-icon" />
                    )}
                </div>

                <div className="product-list">
                    {displayProducts.map((product) => {
                        const currentQuantity = quantities[product.id] || 1;
                        const availableStock = Math.max(0, product.stock || 0);
                        const isOutOfStock = availableStock <= 0;
                        const isAdded = addedProducts[product.id];
                        const isOptionsOpen = expandedOptions[product.id];
                        const productSessionVariants = sessionVariants[product.id] || [];

                        return (
                            <div key={product.id} className={`product-list-item ${isAdded ? 'just-added' : ''}`}>
                                {/* Product Image */}
                                <div
                                    className="product-item-image"
                                    onClick={() => product.imageUrl && setSelectedImage(product.imageUrl)}
                                    style={{ cursor: product.imageUrl ? 'zoom-in' : 'default' }}
                                >
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} loading="lazy" />
                                    ) : (
                                        <div className="product-item-placeholder">
                                            <Package size={24} />
                                        </div>
                                    )}
                                </div>

                                {/* Product Info */}
                                <div className="product-item-info">
                                    <h3 className="product-item-name">{product.name || product.productCode || 'Sin nombre'}</h3>
                                    <p className="product-item-details">
                                        {product.productCode && <span>{product.productCode}</span>}
                                        {product.color && <span> · {product.color}</span>}
                                        {product.sizes && product.sizes.length > 0 && <span> · Talles: {product.sizes.join(', ')}</span>}
                                    </p>
                                    <div className="product-item-meta">
                                        <span className="product-item-price">{formatPrice(product.price)}</span>
                                        <span className={`product-item-stock ${availableStock < 10 ? 'low' : ''}`}>
                                            {isOutOfStock ? 'Sin stock' : `${availableStock} disp.`}
                                        </span>
                                    </div>

                                    {/* Options toggle */}
                                    {!isOutOfStock && (
                                        <button
                                            className="variant-options-toggle"
                                            onClick={() => toggleOptions(product.id)}
                                            type="button"
                                        >
                                            Opciones {isOptionsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                    )}
                                </div>

                                {/* Session variants summary - below product info */}
                                {productSessionVariants.length > 0 && (
                                    <div className="variant-session-summary">
                                        <span className="variant-session-count">
                                            {productSessionVariants.length} variante{productSessionVariants.length !== 1 ? 's' : ''} agregada{productSessionVariants.length !== 1 ? 's' : ''}
                                        </span>
                                        <ul className="variant-session-list">
                                            {productSessionVariants.map((v, i) => (
                                                <li key={i} className="variant-session-item">
                                                    {[v.size, v.color].filter(Boolean).join(' / ') || 'Sin opciones'} x{v.quantity}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Actions: qty + add button — only when options panel is CLOSED */}
                                {!isOptionsOpen && (
                                    <div className="product-item-actions">
                                        <div className="quantity-selector-large">
                                            <button
                                                className="qty-btn minus"
                                                onClick={() => handleQuantityChange(product.id, -1, availableStock)}
                                                disabled={currentQuantity <= 1 || isOutOfStock}
                                            >
                                                −
                                            </button>
                                            <span className="qty-value">{currentQuantity}</span>
                                            <button
                                                className="qty-btn plus"
                                                onClick={() => handleQuantityChange(product.id, 1, availableStock)}
                                                disabled={currentQuantity >= availableStock || isOutOfStock}
                                            >
                                                +
                                            </button>
                                        </div>

                                        <button
                                            className={`add-btn-large ${isAdded ? 'added' : ''}`}
                                            onClick={() => handleAddToCart(product)}
                                            disabled={isOutOfStock}
                                        >
                                            {isAdded ? (
                                                <>
                                                    <Check size={18} />
                                                    Añadido
                                                </>
                                            ) : (
                                                <>
                                                    <ShoppingCart size={18} />
                                                    Agregar
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Inline Variant Options Panel — includes qty + add button inside */}
                                {isOptionsOpen && (
                                    <div className="variant-options-panel">
                                        <div className="variant-options-inputs">
                                            <div className="variant-input-group">
                                                <label className="variant-input-label">Talle</label>
                                                <input
                                                    type="text"
                                                    className="variant-input"
                                                    placeholder="Ej: S, M, L, XL"
                                                    value={variantInputs[product.id]?.size || ''}
                                                    onChange={(e) => handleVariantInputChange(product.id, 'size', e.target.value)}
                                                />
                                            </div>
                                            <div className="variant-input-group">
                                                <label className="variant-input-label">Color</label>
                                                <input
                                                    type="text"
                                                    className="variant-input"
                                                    placeholder="Ej: Rojo, Azul"
                                                    value={variantInputs[product.id]?.color || ''}
                                                    onChange={(e) => handleVariantInputChange(product.id, 'color', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Qty + Add button inside the panel */}
                                        <div className="variant-panel-actions">
                                            <div className="quantity-selector-large">
                                                <button
                                                    className="qty-btn minus"
                                                    onClick={() => handleQuantityChange(product.id, -1, availableStock)}
                                                    disabled={currentQuantity <= 1 || isOutOfStock}
                                                >
                                                    −
                                                </button>
                                                <span className="qty-value">{currentQuantity}</span>
                                                <button
                                                    className="qty-btn plus"
                                                    onClick={() => handleQuantityChange(product.id, 1, availableStock)}
                                                    disabled={currentQuantity >= availableStock || isOutOfStock}
                                                >
                                                    +
                                                </button>
                                            </div>

                                            <button
                                                className={`add-btn-large ${isAdded ? 'added' : ''}`}
                                                onClick={() => handleAddToCart(product)}
                                                disabled={isOutOfStock}
                                            >
                                                {isAdded ? (
                                                    <>
                                                        <Check size={18} />
                                                        Añadido
                                                    </>
                                                ) : (
                                                    <>
                                                        <ShoppingCart size={18} />
                                                        Agregar
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* "Add another variant" button */}
                                        {isAdded && (
                                            <button
                                                className="add-another-variant-btn"
                                                onClick={() => handleAddAnotherVariant(product.id)}
                                                type="button"
                                            >
                                                <Plus size={14} />
                                                Agregar otra variación
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Empty state */}
                    {searchTerm && !isSearching && searchResults.length === 0 && (
                        <div className="search-empty">
                            <Package size={48} strokeWidth={1.5} />
                            <p>No encontramos productos para &quot;{searchTerm}&quot;</p>
                            <span>Probá con otro nombre o código</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="search-footer">
                <button className="footer-clear-btn" onClick={() => navigate('/select-products')}>
                    Cancelar
                </button>
                {addedInThisSession && (
                    <button
                        className="footer-search-btn"
                        onClick={() => navigate('/cart')}
                    >
                        <Package size={18} />
                        Ir al carrito
                        {cartItemsCount > 0 && (
                            <span className="cart-badge" aria-label={`${cartUnitsCount} unidades en carrito`}>
                                {cartUnitsCount}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* Add-to-cart Toast */}
            <div className={`add-toast ${addToast.visible ? 'visible' : ''}`} role="status" aria-live="polite">
                <div className="add-toast-content">
                    <div className="add-toast-icon">
                        <Check size={18} />
                    </div>
                    <div className="add-toast-text">
                        <div className="add-toast-title">Añadido al carrito</div>
                        <div className="add-toast-subtitle">
                            {addToast.productName} · x{addToast.quantity}
                        </div>
                    </div>
                </div>
                <button className="add-toast-action" onClick={() => navigate('/cart')}>
                    Ver carrito
                </button>
            </div>
        </div>
    );
}

export default SearchPage;
