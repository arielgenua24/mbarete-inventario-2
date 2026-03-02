import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import useFirestoreContext from '../../hooks/useFirestoreContext';
import ProductFormModal from '../../modals/ProductFormModal';
import QRModal from '../../modals/Qrmodal';
import ProductSearch from '../../components/ProductSearch';
import EditProductBtn from '../../components/EditProduct';
import QRButton from '../../components/QrGenerateBtn';
import LoadingComponent from '../../components/Loading';
import ImageModal from '../../components/ImageModal';
import { auth } from '../../firebaseSetUp';
import qrIcon from '../../assets/icons/icons8-qr-100.png';

import './styles.css';

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
    imageUrl: null
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const PRODUCTS_PER_PAGE = 10;

  // Nuevos estados para la carga masiva
  const [jsonFile, setJsonFile] = useState(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkLoadProgress, setBulkLoadProgress] = useState({ processed: 0, success: 0, errors: 0, total: 0 });
  const [bulkLoadErrorMessages, setBulkLoadErrorMessages] = useState([]);

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

  const handleSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    try {
      await addProduct(
        newProduct.name,
        newProduct.price,
        newProduct.details,
        newProduct.stock,
        newProduct.imageUrl || null
      );
      setIsModalOpen(false);
      setNewProduct({ name: '', price: '', details: '', stock: '', imageUrl: null });
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

  // Funciones para la carga masiva de JSON
  const handleJsonFileChange = (event) => {
    setJsonFile(event.target.files[0]);
    // Limpiar errores/progreso previos al seleccionar un nuevo archivo
    setBulkLoadProgress({ processed: 0, success: 0, errors: 0, total: 0 });
    setBulkLoadErrorMessages([]);
  };

  const handleBulkUpload = async () => {
    if (!jsonFile) {
      alert("Por favor, selecciona un archivo JSON primero.");
      return;
    }

    setIsBulkLoading(true);
    setBulkLoadProgress({ processed: 0, success: 0, errors: 0, total: 0 });
    setBulkLoadErrorMessages([]);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const productsToUpload = JSON.parse(event.target.result);
        if (!Array.isArray(productsToUpload)) {
          throw new Error("El archivo JSON debe contener un array de productos.");
        }

        setBulkLoadProgress(prev => ({ ...prev, total: productsToUpload.length }));
        let currentSuccess = 0;
        let currentErrors = 0;
        const errorMessages = [];

        for (let i = 0; i < productsToUpload.length; i++) {
          const product = productsToUpload[i];
          try {
            if (!product.name || product.price === undefined || product.stock === undefined) {
              throw new Error(`Producto en índice ${i} (${product.name || 'Nombre desconocido'}) tiene datos faltantes o inválidos. Campos requeridos: name, price, size, color, stock.`);
            }
            // Asegurar tipos de datos antes de enviar a addProduct
            await addProduct(
              String(product.name),
              Number(product.price),
              product.details || '',
              Number(product.stock),
              product.imageUrl || null
            );
            currentSuccess++;
          } catch (error) {
            currentErrors++;
            console.error(`Error al agregar producto ${product.name || `en índice ${i}`}:`, error);
            errorMessages.push(`Error con ${product.name || `producto en índice ${i}`}: ${error.message}`);
          }
          setBulkLoadProgress({
            processed: i + 1,
            success: currentSuccess,
            errors: currentErrors,
            total: productsToUpload.length
          });
        }
        setBulkLoadErrorMessages(errorMessages);
        if (errorMessages.length > 0) {
          alert(`Carga masiva completada con errores. ${currentSuccess} productos agregados, ${currentErrors} errores. Revise los mensajes de error.`);
        } else {
          alert(`Carga masiva completada exitosamente. ${currentSuccess} productos agregados.`);
        }
        await loadInitialProducts(); // Recargar productos para reflejar los cambios
      } catch (error) {
        console.error("Error al procesar el archivo JSON:", error);
        const errorMessage = `Error al procesar el archivo JSON: ${error.message}`;
        alert(errorMessage);
        setBulkLoadErrorMessages(prevMessages => [...prevMessages, errorMessage]);
      } finally {
        setIsBulkLoading(false);
        setJsonFile(null);
        if (document.getElementById('json-upload-input')) {
          document.getElementById('json-upload-input').value = ''; // Resetear el input de archivo
        }
      }
    };
    reader.onerror = () => {
      const readErrorMessage = "Error al leer el archivo.";
      alert(readErrorMessage);
      setBulkLoadErrorMessages(prevMessages => [...prevMessages, readErrorMessage]);
      setIsBulkLoading(false);
    };
    reader.readAsText(jsonFile);
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

      {/* Sección de Carga Masiva de JSON */}
      <div className="bulkUploadSection" style={{ margin: '20px 0', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h3 className="subtitle" style={{ marginTop: '0', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>JSON for the developer, Ariel</h3>
        <input
          type="file"
          id="json-upload-input"
          accept=".json"
          onChange={handleJsonFileChange}
          disabled={isBulkLoading}
          style={{ display: 'block', margin: '15px 0', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', width: 'calc(100% - 22px)' }}
        />
        <button
          onClick={handleBulkUpload}
          disabled={!jsonFile || isBulkLoading}
          className="addButton-bulk"
          style={{
            marginRight: '10px',
            backgroundColor: (!jsonFile || isBulkLoading) ? '#bdc3c7' : '#27ae60', // verde para activo, gris para deshabilitado
            color: 'white',
            padding: '10px 20px',
            fontSize: '16px',
            cursor: (!jsonFile || isBulkLoading) ? 'not-allowed' : 'pointer',
            opacity: (!jsonFile || isBulkLoading) ? 0.7 : 1
          }}
        >
          {isBulkLoading ? 'Cargando JSON...' : 'Iniciar Carga de JSON'}
        </button>
        {isBulkLoading && (
          <div style={{ marginTop: '15px' }}>
            <p>Procesando: {bulkLoadProgress.processed} de {bulkLoadProgress.total} productos.</p>
            <p style={{ color: 'green' }}>Éxitos: {bulkLoadProgress.success}</p>
            <p style={{ color: 'red' }}>Errores: {bulkLoadProgress.errors}</p>
            <LoadingComponent isLoading={true} />
          </div>
        )}
        {bulkLoadErrorMessages.length > 0 && !isBulkLoading && (
          <div style={{ marginTop: '20px', color: '#c0392b', border: '1px solid #e74c3c', padding: '15px', borderRadius: '4px', backgroundColor: '#fbeae5' }}>
            <h4 style={{ marginTop: '0', marginBottom: '10px' }}>Detalles de errores en la carga:</h4>
            <ul style={{ paddingLeft: '20px', margin: '0', maxHeight: '150px', overflowY: 'auto' }}>
              {bulkLoadErrorMessages.map((msg, index) => (
                <li key={index} style={{ marginBottom: '5px' }}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
        {!isBulkLoading && bulkLoadProgress.processed > 0 && bulkLoadErrorMessages.length === 0 && bulkLoadProgress.success === bulkLoadProgress.total && (
          <p style={{ marginTop: '15px', color: '#27ae60', fontWeight: 'bold' }}>¡Todos los productos ({bulkLoadProgress.success}) se cargaron exitosamente!</p>
        )}
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
    </div>
  );
};

export default Inventory;