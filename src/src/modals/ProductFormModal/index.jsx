import { useState, useEffect } from 'react'
import useFirestoreContext from '../../hooks/useFirestoreContext'
import useIsAdmin from '../../hooks/useIsAdmin'
import LoadingComponent from '../../components/Loading'
import ImageUpload from '../../components/ImageUpload'
import showSuggestionNotification from '../../utils/showSuggestionNotification'
import searchProducts from '../../utils/searchFn'
import './styles.css'

// eslint-disable-next-line react/prop-types
function ProductFormModal({ handleSubmit, newProduct, setNewProduct, setIsModalOpen }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);
  const [image2, setImage2] = useState(null);
  const [image3, setImage3] = useState(null);

  const { getAllProducts } = useFirestoreContext();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      const fetchedProductsArray = await getAllProducts();
      setProducts(fetchedProductsArray);
      setIsLoading(false);
    };
    loadProducts();
  }, [getAllProducts]);

  const handleNameChange = async (e) => {
    const value = e.target.value;
    setNewProduct({ ...newProduct, name: value });

    if (value.length >= 3) {
      try {
        const results = await searchProducts(products, value);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    const updated = {
      ...newProduct,
      name: suggestion.name,
      price: suggestion.price,
      meliPrice: suggestion.meliPrice ?? newProduct.meliPrice ?? '',
      details: suggestion.details || '',
    };
    if (suggestion.imageUrl) { setImageUrl(suggestion.imageUrl); updated.imageUrl = suggestion.imageUrl; }
    if (suggestion.image2)   { setImage2(suggestion.image2);   updated.image2   = suggestion.image2; }
    if (suggestion.image3)   { setImage3(suggestion.image3);   updated.image3   = suggestion.image3; }
    setNewProduct(updated);
    setSuggestions([]);
    showSuggestionNotification();
  };

  const handleImageUploaded = (url) => {
    setImageUrl(url);
    setNewProduct((prev) => ({ ...prev, imageUrl: url }));
  };

  const handleImage2Uploaded = (url) => {
    setImage2(url);
    setNewProduct((prev) => ({ ...prev, image2: url }));
  };

  const handleImage3Uploaded = (url) => {
    setImage3(url);
    setNewProduct((prev) => ({ ...prev, image3: url }));
  };

  // Close on backdrop click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) setIsModalOpen(false);
  };

  return (
    <div className="pf-overlay" onClick={handleOverlayClick}>
      <div className="pf-dialog" role="dialog" aria-modal="true" aria-label="Nuevo producto">

        {/* Drag handle — mobile only */}
        <div className="pf-drag-wrap">
          <div className="pf-drag-handle" />
        </div>

        {/* Header */}
        <div className="pf-header">
          <h2 className="pf-title">Nuevo Producto</h2>
          <button
            type="button"
            className="pf-close-btn"
            onClick={() => setIsModalOpen(false)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {isLoading && <LoadingComponent isLoading={true} />}

        <form onSubmit={handleSubmit} className="pf-form">
          <div className="pf-body">

            {/* ── Nombre del producto ── */}
            <div className="pf-field">
              <label className="pf-label">Nombre Del Producto</label>
              <input
                type="text"
                value={newProduct.name}
                onChange={handleNameChange}
                className="pf-input"
                placeholder="Ej: Jean cargo azul"
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <div className="pf-suggestions">
                  <div className="pf-suggestions-header">Autocompletado</div>
                  <ul className="pf-suggestions-list">
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="pf-suggestion-item"
                      >
                        <span className="pf-suggestion-name">{suggestion.name}</span>
                        <div className="pf-suggestion-meta">
                          <span className="pf-suggestion-price">${suggestion.price}</span>
                          {suggestion.details && (
                            <span className="pf-suggestion-detail">{suggestion.details}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ── Image uploads ── */}
            <ImageUpload
              onImageUploaded={handleImageUploaded}
              existingImageUrl={imageUrl}
              label="Imagen 1"
            />
            <ImageUpload
              onImageUploaded={handleImage2Uploaded}
              existingImageUrl={image2}
              label="Imagen 2"
            />
            <ImageUpload
              onImageUploaded={handleImage3Uploaded}
              existingImageUrl={image3}
              label="Imagen 3"
            />

            {/* ── Precio + Stock (same row) ── */}
            <div className="pf-row">
              <div className="pf-field">
                <label className="pf-label">Precio</label>
                <input
                  type="number"
                  value={newProduct.price || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  className="pf-input"
                  placeholder="0"
                  required
                  min="0"
                />
              </div>

              <div className="pf-field">
                <label className="pf-label">
                  Cantidad En Inventario
                  {!isAdmin && (
                    <span className="pf-label-badge">🔒 Admin</span>
                  )}
                </label>
                <input
                  type="number"
                  value={newProduct.stock || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  className="pf-input"
                  placeholder="0"
                  disabled={!isAdmin}
                  required={!!isAdmin}
                  min="0"
                  title={!isAdmin ? 'Solo el administrador puede modificar el stock' : ''}
                />
                {!isAdmin && (
                  <p className="pf-admin-hint">Solo admin puede editar</p>
                )}
              </div>
            </div>

            {/* ── Precio Mercado Libre ── */}
            <div className="pf-field pf-field--meli">
              <label className="pf-label pf-label--meli">
                <span className="pf-meli-badge">meli</span>
                Precio Mercado Libre
              </label>
              <input
                type="number"
                value={newProduct.meliPrice || ''}
                onChange={(e) => setNewProduct({ ...newProduct, meliPrice: e.target.value })}
                className="pf-input pf-input--meli"
                placeholder="0"
                min="0"
              />
              <p className="pf-hint">Se sincroniza automáticamente con productos del mismo nombre.</p>
            </div>

            {/* ── Detalles ── */}
            <div className="pf-field">
              <label className="pf-label">Detalles Del Producto</label>
              <textarea
                value={newProduct.details || ''}
                onChange={(e) => setNewProduct({ ...newProduct, details: e.target.value })}
                className="pf-input pf-textarea"
                placeholder="Descripción del producto, materiales, etc."
                rows={3}
              />
            </div>

            {/* ── Talles + Categoría (same row) ── */}
            <div className="pf-row">
              <div className="pf-field">
                <label className="pf-label">Talles Disponibles</label>
                <input
                  type="text"
                  value={newProduct.sizes || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, sizes: e.target.value })}
                  className="pf-input"
                  placeholder="S,M,L,XL"
                />
                <p className="pf-hint">Separados por coma. Se mostrarán en la página web.</p>
              </div>

              <div className="pf-field">
                <label className="pf-label">Categoría</label>
                <select
                  value={newProduct.category || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="pf-input pf-input--select"
                >
                  <option value="">Sin categoría</option>
                  <option value="jean">Jean</option>
                  <option value="bermuda">Bermuda</option>
                  <option value="baggy">Baggy</option>
                  <option value="joggers">Joggers</option>
                  <option value="parachutte">Parachutte</option>
                  <option value="frisa">Frisa</option>
                  <option value="Camperas">Camperas</option>
                  <option value="Chalecos">Chalecos</option>
                  <option value="Clásico">Clásico</option>
                  <option value="Nuevos">Nuevos</option>
                  <option value="ReIngreso">ReIngreso</option>
                  <option value="PocoStock">Poco Stock</option>
                </select>
              </div>
            </div>

          </div>

          {/* ── Sticky action footer ── */}
          <div className="pf-footer">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="pf-btn pf-btn-cancel"
            >
              Salir
            </button>
            <button type="submit" className="pf-btn pf-btn-save">
              Guardar
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default ProductFormModal;
