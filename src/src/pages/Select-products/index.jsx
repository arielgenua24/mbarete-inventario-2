import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useProducts from "../../hooks/useProducts";
import { useOrder } from "../../hooks/useOrder";
import FakeSearchBar from "../../components/FakeSearchBar";
import ImageModal from "../../components/ImageModal";
import qrIcon from '../../assets/icons/icons8-qr-100.png';
import './styles.css'

function SelectProducts() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const PRODUCTS_PER_PAGE = 10;

  const navigate = useNavigate();

  const { getProductsPaginated } = useProducts();

  const loadInitialProducts = useCallback(async () => {
    console.log('[loadInitialProducts] Iniciando carga inicial desde IndexedDB.');
    setIsLoading(true);
    try {
      const result = await getProductsPaginated(PRODUCTS_PER_PAGE, 0);
      console.log('[loadInitialProducts] Resultado:', result);

      setProducts(result.products);
      setCurrentPage(0);
      setHasMore(result.hasMore);
      console.log(`[loadInitialProducts] ✅ Cargados ${result.products.length} productos`);
    } catch (error) {
      console.error("[loadInitialProducts] Error cargando productos:", error);
      setProducts([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [getProductsPaginated, PRODUCTS_PER_PAGE]);

  const loadMoreProducts = useCallback(async () => {
    console.log('[loadMoreProducts] Iniciando. Página actual:', currentPage);
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const nextPage = currentPage + 1;
      const result = await getProductsPaginated(PRODUCTS_PER_PAGE, nextPage);
      console.log('[loadMoreProducts] Resultado:', result);

      setProducts(prevProducts => [...prevProducts, ...result.products]);
      setCurrentPage(nextPage);
      setHasMore(result.hasMore);
      console.log(`[loadMoreProducts] ✅ Agregados ${result.products.length} productos más`);
    } catch (error) {
      console.error("[loadMoreProducts] Error cargando más productos:", error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [getProductsPaginated, isLoading, hasMore, currentPage, PRODUCTS_PER_PAGE]);

  useEffect(() => {
    console.log('[useEffect] Montaje del componente: Llamando a loadInitialProducts.');
    loadInitialProducts();
  }, [loadInitialProducts]); // <--- DEPENDENCIA RESTAURADA PARA ESLINT


  const modalOverlayStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };
  const modalContentStyles = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    textAlign: 'center'
  };
  const spinnerStyles = {
    width: '32px',
    height: '32px',
    margin: '16px auto 0',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  };


  return (
    <div className="container">
      <h1 className="TITLE" style={{ fontSize: '26px', marginBottom: '24px', fontWeight: '700' }}>Agregar productos</h1>

      {/* Fake Search Bar - Redirects to full search page */}
      <FakeSearchBar placeholder="Buscar productos..." />

      <button
        style={{
          backgroundColor: '#F1F7FF',
          border: '1px solid #0990FF',
          borderRadius: '20px',
          color: '#0990FF',
          fontSize: '14px',
          fontWeight: '600',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '16px 0'
        }}
        onClick={() => {
          navigate('/qrsearch?redirect=select-product');
        }}>
        <img src={qrIcon} alt="Qr icon" style={{
          width: '24px',
          height: '24px',
        }} />
        Agregar por QR</button>


      <section>
        <h2 className="subtitle">TODO TU CATÁLOGO</h2>
        <div className="inventory">
          {isLoading && products.length === 0 ? (
            <p>Cargando productos...</p>
          ) : Array.isArray(products) && products.length > 0 ? (
            products.map(product => (
              <div key={product.id} className="productCard">
                {/* {console.log(product) } 
                    {console.log(product.id)} */}

                {/* Product Image */}
                {product.imageUrl && (
                  <div
                    className="productImageContainer"
                    onClick={() => setSelectedImage(product.imageUrl)}
                    style={{ cursor: 'zoom-in', marginBottom: '15px' }}
                  >
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="productImage"
                      style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                  </div>
                )}

                <h3 className="productTitle">{product.name}</h3>
                <p className="productDetail">{product.productCode}</p>
                <p className="productDetail">Precio: ${product.price}</p>
                <p className="productDetail">Stock: {product.stock}</p>
                <p className="productDetail">{product.details || 'Sin detalles'}</p>


                <button
                  className="add-to-cart-button"
                  onClick={() => navigate(`/select-product-amount/${product.id}`)}
                >
                  AGREGAR AL CARRITO
                </button>

              </div>


            ))
          ) : (
            <p>No tienes productos, agrega un producto a tu catálogo.</p>
          )}
        </div>

        {!isLoading && hasMore && products.length > 0 && (
          <button onClick={loadMoreProducts} className="loadMoreButton" style={{ margin: '20px auto', display: 'block' }}>
            Cargar más productos
          </button>
        )}
        {!isLoading && !hasMore && products.length > 0 && (
          <p style={{ textAlign: 'center', margin: '20px' }}>No hay más productos para mostrar.</p>
        )}
      </section>

      {/* El modal de "Aguarde un momento" se mostrará basado en el isLoading global,
             lo cual está bien para la carga inicial y la carga de más productos. */}
      {isLoading && (
        <div style={modalOverlayStyles}>
          <div style={modalContentStyles}>
            <p style={{ fontSize: '18px', color: '#333' }}>Aguarde un momento...</p>
            <div style={spinnerStyles}></div>
          </div>
        </div>
      )}

      <ImageModal
        isOpen={!!selectedImage}
        imageSrc={selectedImage}
        onClose={() => setSelectedImage(null)}
      />

    </div>
  );
}

export default SelectProducts;