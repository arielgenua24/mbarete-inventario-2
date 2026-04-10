import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useFirestoreContext from '../../hooks/useFirestoreContext';
import useIsAdmin from '../../hooks/useIsAdmin';
import LoadingComponent from "../../components/Loading";
import ImageUpload from "../../components/ImageUpload";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import './styles.css';

function Product() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState({});
  const [changes, setChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { getProduct, updateProduct } = useFirestoreContext();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price);
  const [stock, setStock] = useState(product.stock);
  const [details, setDetails] = useState(product.details);
  const [imageUrl, setImageUrl] = useState(product.imageUrl);
  const [image2, setImage2] = useState(product.image2);
  const [image3, setImage3] = useState(product.image3);
  // Talles como string editable "38,40,42" para facilitar edición
  const [sizesInput, setSizesInput] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);

      const fetchedProduct = await getProduct(id);
      if (fetchedProduct === undefined) {
        alert('El producto no existe');
        setIsLoading(false);
        navigate('/inventory');
        return;
      }
      setProduct(fetchedProduct);

      setName(fetchedProduct.name);
      setPrice(fetchedProduct.price);
      setStock(fetchedProduct.stock);
      setDetails(fetchedProduct.details || '');
      setImageUrl(fetchedProduct.imageUrl || null);
      setImage2(fetchedProduct.image2 || null);
      setImage3(fetchedProduct.image3 || null);
      // Convertir array de talles a string para edición
      const existingSizes = Array.isArray(fetchedProduct.sizes)
        ? fetchedProduct.sizes.join(',')
        : (fetchedProduct.sizes || '');
      setSizesInput(existingSizes);
      setCategory(fetchedProduct.category || '');
      setIsLoading(false);
    };
    loadProducts();
  }, [getProduct, id, navigate]);

  const handleInputChange = (setter) => (e) => {
    setter(e.target.value);
    setChanges(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const currentDate = new Date();
    const formattedDate = format(currentDate, 'yyyy-MM-dd HH:mm:ss', { locale: es });

    // Parsear talles: "38,40,42" → [38, 40, 42]
    const parsedSizes = sizesInput
      ? sizesInput.split(',').map(s => {
          const trimmed = s.trim();
          const n = parseInt(trimmed, 10);
          return isNaN(n) ? trimmed : n;
        }).filter(s => s !== '' && s !== null)
      : [];

    const updatedProduct = {
      id,
      name,
      price: price === '' ? 0 : Number(price),
      stock: stock === '' ? 0 : Number(stock),
      details,
      updatedAt: formattedDate,
      imageUrl: imageUrl || null,
      image2: image2 || null,
      image3: image3 || null,
      sizes: parsedSizes,
      category: category || '',
    };
    try {
      await updateProduct(updatedProduct.id, updatedProduct);
      setIsLoading(false);
      navigate('/inventory');
    } catch (error) {
      setIsLoading(false);
      console.error("Error al actualizar el producto:", error);
    }
  };


  return (
    <div className="product-editor-page">
      {isLoading && <LoadingComponent />}
      <section className="product-editor-shell">
        <header className="product-editor-header">
          <button
            type="button"
            className="product-editor-back"
            onClick={() => navigate('/inventory')}
          >
            Volver a inventario
          </button>
          <p className="product-editor-kicker">Gestion de producto</p>
          <h1 className="product-editor-title">{name || product.name || 'Editar producto'}</h1>
          <p className="product-editor-subtitle">
            Actualiza nombre, precio, detalles e imagen para que el catalogo sea claro y confiable para el equipo.
          </p>
        </header>

        <form className="product-editor-form" onSubmit={handleSubmit}>
          <div className="product-editor-grid">
            <label className="product-editor-field">
              <span>Nombre del producto</span>
              <input
                type="text"
                className="product-editor-input"
                placeholder={product.name ? `Ej: ${product.name}` : 'Escribe un nombre claro'}
                value={name || ''}
                onChange={handleInputChange(setName)}
                required
              />
            </label>

            <label className="product-editor-field">
              <span>Precio de venta</span>
              <input
                type="number"
                className="product-editor-input"
                placeholder={product.price !== undefined ? `Ej: ${product.price}` : '0'}
                value={price ?? ''}
                onChange={handleInputChange(setPrice)}
                min="0"
                step="0.01"
                required
              />
            </label>

            <label className="product-editor-field product-editor-field-full">
              <span>Detalles del producto</span>
              <textarea
                className="product-editor-input product-editor-textarea"
                placeholder={product.details || 'Describe textura, uso, composicion o datos clave'}
                value={details || ''}
                onChange={handleInputChange(setDetails)}
                rows={4}
              />
            </label>

            <div className="product-editor-field product-editor-field-full">
              <ImageUpload
                onImageUploaded={(url) => {
                  setImageUrl(url);
                  setChanges(true);
                }}
                existingImageUrl={imageUrl}
                label="Imagen 1"
              />
            </div>

            <div className="product-editor-field product-editor-field-full">
              <ImageUpload
                onImageUploaded={(url) => {
                  setImage2(url);
                  setChanges(true);
                }}
                existingImageUrl={image2}
                label="Imagen 2"
              />
            </div>

            <div className="product-editor-field product-editor-field-full">
              <ImageUpload
                onImageUploaded={(url) => {
                  setImage3(url);
                  setChanges(true);
                }}
                existingImageUrl={image3}
                label="Imagen 3"
              />
            </div>

            <label className="product-editor-field product-editor-field-full">
              <span className="product-editor-stock-label">
                Cantidad en stock
                {!isAdmin && (
                  <span className="product-editor-lock">Solo admin</span>
                )}
              </span>
              <input
                type="number"
                className={`product-editor-input ${!isAdmin || isAdminLoading ? 'product-editor-input-locked' : ''}`}
                placeholder={product.stock !== undefined ? `Stock actual: ${product.stock}` : '0'}
                value={stock ?? ''}
                onChange={handleInputChange(setStock)}
                disabled={!isAdmin || isAdminLoading}
                title={!isAdmin ? 'Solo el administrador puede modificar el stock' : ''}
                min="0"
              />
              {!isAdmin && (
                <small className="product-editor-hint">
                  Este campo esta bloqueado para evitar cambios de stock no autorizados.
                </small>
              )}
            </label>
          </div>

            {/* Talles */}
            <label className="product-editor-field product-editor-field-full">
              <span>Talles disponibles</span>
              <input
                type="text"
                className="product-editor-input"
                placeholder="Ej: 38,40,42,44 o S,M,L,XL"
                value={sizesInput}
                onChange={(e) => { setSizesInput(e.target.value); setChanges(true); }}
              />
              <small className="product-editor-hint">Separados por coma. Se mostrarán en la página web.</small>
            </label>

            {/* Categoría */}
            <label className="product-editor-field product-editor-field-full">
              <span>Categoría</span>
              <select
                className="product-editor-input"
                value={category}
                onChange={(e) => { setCategory(e.target.value); setChanges(true); }}
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
            </label>

          <div className="product-editor-actions">
            {changes ? (
              <button type="submit" className="product-editor-save">Guardar cambios</button>
            ) : (
              <button
                type="button"
                className="product-editor-cancel"
                onClick={() => navigate('/inventory')}
              >
                Volver sin cambios
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

export default Product;
