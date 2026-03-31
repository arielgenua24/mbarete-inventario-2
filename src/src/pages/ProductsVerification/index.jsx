import { useState, useEffect, useMemo } from 'react';
import useFirestoreContext from '../../hooks/useFirestoreContext';
import { useOrder } from '../../hooks/useOrder';
import useOrderDetails from '../../hooks/useOrderDetails';
import LoadingComponent from '../../components/Loading';
import { useParams, useSearchParams } from 'react-router-dom';
import QrVerifyProduct from '../../components/QrVerifyProduct';
import ProductVerificationStatus from '../../components/ProductVerificationStatus';
import { useNavigate } from 'react-router-dom';

import './styles.css';

const ProductVerification = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSearchByQrEnabled, setisSearchByQrEnabled] = useState(false);
  const { orderId } = useParams();
  const [verifiedProducts, setVerifiedProducts] = useState(0);
  const [isLoading, setIsLoading] = useState(false)

  const { updateOrder } = useFirestoreContext();
  const { getOrderWithProducts } = useOrderDetails();
  const { setOrdersState } = useOrder()

  const orderEstado = searchParams.get("orderEstado");
  console.log(orderEstado)

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const orderDetails = await getOrderWithProducts(orderId);
        const productsData = orderDetails?.products || [];
        setProducts(productsData);
        console.log('Products loaded for verification:', productsData);
      } catch (error) {
        console.error('Error loading products for verification:', error);
        setProducts([]);
      }
      setLoading(false);
    };
    fetchProducts();
  }, [orderId, getOrderWithProducts]);

  const handleVerify = (productId) => {
    console.log(productId)
    setProducts(prevProducts =>
      prevProducts.map(product => {
        if (product.id === productId && product.verified < product.stock) {
          return { ...product, verified: product.verified + 1 };
        }
        return product;
      })
    );
    setisSearchByQrEnabled(false);

  };

  const handleReset = (productId) => {
    if (window.confirm('¿Estás seguro de que empezar de cero la verificacion?')) {
      setProducts(prevProducts =>
        prevProducts.map(product => {
          if (product.id === productId) {
            return { ...product, verified: 0 };
          }
          return product;
        })
      );
    }
  };

  const handleUpdateOrder = async () => {
    setIsLoading(true);
    try {
      await updateOrder(orderId, {
        "estado": "listo para despachar"
      });

      // Actualizar el estado en setOrdersState
      setOrdersState((prevState) =>
        prevState.map((order) =>
          order.id === orderId ? { ...order, state: "listo para despachar" } : order
        )
      );

      setIsLoading(false);
      navigate('/orders');
    } catch (error) {
      console.error("Error al actualizar la orden:", error);
      // Aquí podrías agregar alguna notificación de error al usuario
    }
  };

  const totalFinal = useMemo(() => {
    return products.reduce((acumulador, producto) => {
      // Se calcula el total por producto: stock * precio
      return acumulador + (producto.stock * producto.productData.price);
    }, 0);
  }, [products]);

  return (
    <div className="products-verification">
      <LoadingComponent isLoading={loading} />

      {orderEstado !== 'listo para despachar' && <h1>Productos Verificados: {verifiedProducts} de {products.length} </h1>}

      {orderEstado !== 'listo para despachar' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', flexDirection: 'column' }}>
          {/*<button
                style={{backgroundColor: 'F1F7FF', color: '#0990FF', border: '1px solid #0990FF', display: 'flex' ,justifyContent: 'space-around', alignItems: 'center'}}
                className='btn-verify'
                onClick={() => setisSearchByQrEnabled(true)}
                disabled={(verifiedProducts === products.length)}
              >
                <img src={qrIcon} alt="Qr icon" style={{
                  width: '47px',
                  height: '47px',
              }} />

                Verificar escaner de barras
              </button> */}


        </div>)}

      <div className="pv-final-total-wrapper">
        <div className="pv-final-total">
          <span className="pv-total-label">Total Final</span>
          <span className="pv-total-amount">${totalFinal.toLocaleString()} ✅</span>
        </div>
      </div>

      {products.map((product) => (
        <div key={product.id} className="pv-product-item">
          <ProductVerificationStatus orderStatus={orderEstado} product={product} verifiedProducts={verifiedProducts} setVerifiedProducts={setVerifiedProducts} />
          <h3>Codigo del producto: {product.productData.productCode}</h3>
          {orderEstado == 'listo para despachar' ? (<div className="pv-verification-complete">
            <div className="pv-product-details">
              {/* Product Image - Dispatch Mode */}
              {product.productData?.imageUrl && (
                <div className="pv-image-wrap">
                  <img
                    src={product.productData.imageUrl}
                    alt={product.productData.name}
                    loading="lazy"
                    className="pv-product-image pv-dispatch-image"
                  />
                </div>
              )}

              <div className="pv-product-info">
                <p className="pv-stock-info">
                Total verificado: <span>{product.stock} unidades</span>
              </p>
                <div className="pv-product-specs">
                  <p>
                    <strong>Producto:</strong> {product.productData.name}
                  </p>
                  <p>
                    <strong>Detalles:</strong> {product.productData.details || 'Sin detalles'}
                  </p>
                  {product.selectedVariants?.color && (
                    <p>
                      <strong>Color:</strong> {product.selectedVariants.color}
                    </p>
                  )}
                  {product.selectedVariants?.size ? (
                    <p>
                      <strong>Talle:</strong> {product.selectedVariants.size}
                    </p>
                  ) : product.productData?.sizes?.length > 0 && (
                    <p>
                      <strong>Talles disponibles:</strong> {product.productData.sizes.join(', ')}
                    </p>
                  )}
                  <p>
                    <strong>Precio:</strong> {product.productData.price}
                  </p>
                  <div className="pv-total-price-container">
                    <p className="pv-total-price">
                      <strong>Total:</strong>
                      <span>${product.stock * product.productData.price}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>)
            : (
              <div>
                {/* Product Image - Verification Mode */}
                {product.productSnapshot?.imageUrl && (
                  <div className="pv-image-wrap">
                    <img
                      src={product.productSnapshot.imageUrl}
                      alt={product.productSnapshot.name}
                      loading="lazy"
                      className="pv-product-image"
                    />
                  </div>
                )}

                <p>
                  Verificados: <span>{product.verified}</span> de {product.stock}
                </p>

                <p>
                  <strong>Producto:</strong> {product.productSnapshot.name}
                </p>
                <p>
                  <strong>Detalles:</strong> {product.productSnapshot.details || 'Sin detalles'}
                </p>
                {product.selectedVariants?.color && (
                  <p>
                    <strong>Color:</strong> {product.selectedVariants.color}
                  </p>
                )}
                {product.selectedVariants?.size ? (
                  <p>
                    <strong>Talle:</strong> {product.selectedVariants.size}
                  </p>
                ) : product.productSnapshot?.sizes?.length > 0 && (
                  <p>
                    <strong>Talles disponibles:</strong> {product.productSnapshot.sizes.join(', ')}
                  </p>
                )}
                <p>
                  <strong>Precio:</strong> {product.productSnapshot.price}
                </p>
              </div>


            )}
          {orderEstado !== 'listo para despachar' && (
            <div className="pv-verification-actions">
              <button
                className='pv-btn pv-btn-manual'
                onClick={() => handleVerify(product.id)}
                disabled={product.verified >= product.stock}
              >
                Verificar uno manualmente
              </button>
              <button
                className='pv-btn pv-btn-reset'
                onClick={() => handleReset(product.id)}
              >
                Empezar de cero la verificación
              </button>
            </div>
          )}


        </div>
      ))}
      {isSearchByQrEnabled && <QrVerifyProduct
        handleVerify={handleVerify}
        setisSearchByQrEnabled={setisSearchByQrEnabled}

      />}

      {verifiedProducts === products.length &&
        (<button
          onClick={handleUpdateOrder}
          style={{
            position: 'fixed',
            bottom: '1rem', // bottom-4 es 1rem
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#007AFF',
            color: 'white',
            padding: '0.75rem 1.5rem', // px-6 es 1.5rem y py-3 es 0.75rem
            borderRadius: '0.5rem', // rounded-lg es 0.5rem
            transition: 'background-color 0.3s ease', // transition-colors
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // shadow-lg
            ':hover': {
              backgroundColor: '#0066CC',
            },
          }}
        >
          Marcar como Listo para Despachar
        </button>)}


    </div>
  );
};

export default ProductVerification;
