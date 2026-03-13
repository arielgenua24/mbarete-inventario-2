import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import useFirestoreContext from '../../hooks/useFirestoreContext';
import ProductFormModal from '../../modals/ProductFormModal';
import QRModal from '../../modals/Qrmodal';
import AIChatModal from '../../modals/AIChatModal';
import AIResultsModal from '../../modals/AIResultsModal';
import AIHistoryModal, { saveSessionToHistory } from '../../modals/AIHistoryModal';
import ProductSearch from '../../components/ProductSearch';
import EditProductBtn from '../../components/EditProduct';
import QRButton from '../../components/QrGenerateBtn';
import LoadingComponent from '../../components/Loading';
import ImageModal from '../../components/ImageModal';
import { auth } from '../../firebaseSetUp';
import qrIcon from '../../assets/icons/icons8-qr-100.png';

import './styles.css';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [QRcode, setQRcode] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    details: '',
    stock: '',
    imageUrl: null,
    sizes: '',
    category: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const PRODUCTS_PER_PAGE = 10;

  // Estados para carga con IA (capturas de pantalla)
  const [aiImageFile, setAiImageFile] = useState(null);
  const [aiImagePreviewUrl, setAiImagePreviewUrl] = useState('');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSavedProducts, setAiSavedProducts] = useState([]);
  const [isAiResultsOpen, setIsAiResultsOpen] = useState(false);
  const [isAiHistoryOpen, setIsAiHistoryOpen] = useState(false);

  const navigate = useNavigate();
  const { getProducts, addProduct, deleteProduct, user } = useFirestoreContext();
  console.log(user)

  console.log(auth.currentUser?.email);

  const loadInitialProducts = useCallback(async () => {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      const { products: initialProducts, lastVisibleDoc: newLastVisibleDoc } = await getProducts(PRODUCTS_PER_PAGE);
      setProducts(initialProducts);
      setLastVisibleDoc(newLastVisibleDoc);
      setHasMore(initialProducts.length === PRODUCTS_PER_PAGE);
    } catch (error) {
      console.error("Error cargando productos iniciales:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getProducts, PRODUCTS_PER_PAGE]);

  const loadMoreProducts = useCallback(async () => {
    if (isLoading || !hasMore || !lastVisibleDoc) return;
    setIsLoading(true);
    try {
      const { products: newProducts, lastVisibleDoc: newLastVisibleDoc } = await getProducts(PRODUCTS_PER_PAGE, lastVisibleDoc);
      setProducts(prevProducts => [...prevProducts, ...newProducts]);
      setLastVisibleDoc(newLastVisibleDoc);
      setHasMore(newProducts.length === PRODUCTS_PER_PAGE);
    } catch (error) {
      console.error("Error cargando más productos:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getProducts, isLoading, hasMore, lastVisibleDoc]);

  useEffect(() => {
    loadInitialProducts();
  }, [loadInitialProducts]);

  useEffect(() => {
    return () => {
      if (aiImagePreviewUrl) {
        URL.revokeObjectURL(aiImagePreviewUrl);
      }
    };
  }, [aiImagePreviewUrl]);

  const handleSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    try {
      await addProduct(
        newProduct.name,
        newProduct.price,
        newProduct.details,
        newProduct.stock,
        newProduct.imageUrl || null,
        newProduct.sizes || '',
        newProduct.category || ''
      );
      setIsModalOpen(false);
      setNewProduct({ name: '', price: '', details: '', stock: '', imageUrl: null, sizes: '', category: '' });
      await loadInitialProducts();
    } catch (error) {
      console.error("Error al agregar producto:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      try {
        setIsLoading(true);
        await deleteProduct(productId);
        setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
      } catch (error) {
        console.error("Error al eliminar el producto:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAiImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAiImageFile(null);
      setAiImagePreviewUrl('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen.');
      event.target.value = '';
      return;
    }
    if (aiImagePreviewUrl) {
      URL.revokeObjectURL(aiImagePreviewUrl);
    }
    setAiImageFile(file);
    setAiImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleAiAnalyze = () => {
    if (!aiImageFile) {
      alert('Por favor, sube una imagen primero.');
      return;
    }
    if (!OPENROUTER_API_KEY) {
      alert('Falta la API key de OpenRouter. Configura VITE_OPENROUTER_API_KEY.');
      return;
    }
    setIsAiModalOpen(true);
  };

  const handleProductsDetected = (savedProducts) => {
    loadInitialProducts();
    if (savedProducts?.length > 0) {
      saveSessionToHistory(savedProducts);
      setAiSavedProducts(savedProducts);
      setIsAiResultsOpen(true);
    }
  };

  const handleCloseAiModal = () => {
    setIsAiModalOpen(false);
    // Reset AI states when closing modal
    setAiImageFile(null);
    setAiImagePreviewUrl('');
  };

  return (
    <div className="container">
      <h1 className="TITLE">CATÁLOGO</h1>

      <button
        style={{
          backgroundColor: '#F1F7FF',
          border: '1px solid #0990FF',
          borderRadius: '20px',
          color: '#0990FF',
          fontSize: '16px',
          fontWeight: 'bold',
          padding: '10px 15px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}
        onClick={() => {
          navigate('/qrsearch?redirect=product_data');
        }}> BUSCAR POR QR
        <img src={qrIcon} alt="Qr icon" style={{
          width: '30px',
          height: '30px',
        }} />
      </button>

      <ProductSearch products={products} setQRcode={setQRcode} />

      {/* Sección de Carga con IA */}
      <div className="aiUploadSection">
        <h3>Nuevo</h3>
        <p className="aiUploadTagline">Cargá tu catálogo con IA</p>

        <input
          type="file"
          id="ai-image-upload-input"
          accept="image/*"
          onChange={handleAiImageChange}
          className="aiFileInput"
        />

        {aiImagePreviewUrl ? (
          <label htmlFor="ai-image-upload-input" style={{ cursor: 'pointer' }}>
            <img
              src={aiImagePreviewUrl}
              alt="Vista previa de la captura"
              className="aiPreviewImg"
            />
          </label>
        ) : (
          <label htmlFor="ai-image-upload-input" className="aiDropZone">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="aiDropZoneText">Subí una captura de WhatsApp</span>
            <span className="aiDropZoneSubtext">JPG, PNG · Toca para seleccionar</span>
          </label>
        )}

        <div className="aiActionsRow">
          <button
            onClick={handleAiAnalyze}
            disabled={!aiImageFile}
            className="aiAnalyzeBtn"
          >
            ✦ Analizar y guardar con IA
          </button>
          <button
            onClick={() => setIsAiHistoryOpen(true)}
            className="aiHistoryBtn"
            title="Ver historial de cargas"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
        </div>

        <p className="aiUploadHint">
          La IA detecta los productos y los guarda automáticamente en tu catálogo.
        </p>
      </div>

      <section>
        <h2 className="subtitle">TODO TU CATÁLOGO</h2>
        <div className="inventory">
          {isLoading && products.length === 0 && <LoadingComponent isLoading={true} />}
          {!isLoading && products.length === 0 && (
            <p>No tienes productos, agrega un producto a tu catálogo.</p>
          )}
          {products.map(product => (
            <div key={product.id} className="productCard">

              <div className='deleteButtonContainer'>
                <button
                  className="deleteButton"
                  style={{ backgroundColor: 'red', color: 'white' }}
                  onClick={() => handleDelete(product.id)}
                >
                  ELIMINAR
                </button>
              </div>

              {/* Product Image */}
              {product.imageUrl && (
                <div
                  className="productImageContainer"
                  onClick={() => setSelectedImage(product.imageUrl)}
                  style={{ cursor: 'zoom-in' }}
                >
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="productImage"
                    loading="lazy"
                  />
                </div>
              )}

              <h3 className="productTitle">{product.name}</h3>
              <p className="productDetail">{product.productCode}</p>
              <p className="productDetail">Precio: ${product.price}</p>
              <p className="productDetail">Stock: {product.stock}</p>
              <p className="productDetail">{product.details || 'Sin detalles'}</p>


              <QRButton
                product={product}
                onQRGenerate={() => setQRcode(product)}
              />


              <EditProductBtn product_id={product.id} />

            </div>
          ))}
        </div>

        {isLoading && products.length > 0 && <LoadingComponent isLoading={true} />}
        {!isLoading && hasMore && (
          <button onClick={loadMoreProducts} className="loadMoreButton">
            Cargar más productos
          </button>
        )}
        {!isLoading && !hasMore && products.length > 0 && (
          <p style={{ textAlign: 'center', margin: '20px' }}>No hay más productos para mostrar.</p>
        )}

      </section>

      <button
        onClick={() => setIsModalOpen(true)}
        className="addButton"
      >
        + Agregar Producto
      </button>

      {isModalOpen && (
        <ProductFormModal handleSubmit={handleSubmit} newProduct={newProduct} setNewProduct={setNewProduct} setIsModalOpen={setIsModalOpen} />
      )}

      {QRcode && (
        <QRModal
          QRcode={QRcode}
          setQRcode={setQRcode}
        />
      )}

      <ImageModal
        isOpen={!!selectedImage}
        imageSrc={selectedImage}
        onClose={() => setSelectedImage(null)}
      />

      <AIChatModal
        isOpen={isAiModalOpen}
        onClose={handleCloseAiModal}
        aiImageFile={aiImageFile}
        aiImagePreviewUrl={aiImagePreviewUrl}
        onProductsDetected={handleProductsDetected}
        addProduct={addProduct}
      />

      <AIResultsModal
        isOpen={isAiResultsOpen}
        onClose={() => setIsAiResultsOpen(false)}
        savedProducts={aiSavedProducts}
      />

      <AIHistoryModal
        isOpen={isAiHistoryOpen}
        onClose={() => setIsAiHistoryOpen(false)}
      />
    </div>
  );
};

export default Inventory;
