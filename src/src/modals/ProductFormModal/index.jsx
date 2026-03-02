import { useState, useEffect } from 'react'
import useFirestoreContext from '../../hooks/useFirestoreContext'
import useIsAdmin from '../../hooks/useIsAdmin'
import LoadingComponent from '../../components/Loading'
import ImageUpload from '../../components/ImageUpload'
import showSuggestionNotification from '../../utils/showSuggestionNotification'
import searchProducts from '../../utils/searchFn'
import './styles.css'

// eslint-disable-next-line react/prop-types
function ProductFormModal({handleSubmit, newProduct, setNewProduct, setIsModalOpen}){
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);

  const {getAllProducts} = useFirestoreContext();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true)
      const fetchedProductsArray = await getAllProducts();
      setProducts(fetchedProductsArray);
      console.log('All products fetched for suggestions:', fetchedProductsArray);
      setIsLoading(false)
    };
    loadProducts();
  }, [getAllProducts]);

  const handleNameChange = async (e) => {
    const value = e.target.value;
    console.log(value)
    setNewProduct({ ...newProduct, name: value });
    
    // Realizamos la búsqueda cuando el texto tiene al menos 3 caracteres
    if (value.length >= 3) {
      console.log('working search')
      try {
        const results = await searchProducts(products, value);
        setSuggestions(results);
      } catch (error) {
        console.error("Error al buscar productos:", error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    // Al hacer click en la sugerencia, se completan los datos deseados
    setNewProduct({
      ...newProduct,
      name: suggestion.name,
      price: suggestion.price,
      details: suggestion.details || '',
    });
    // If suggestion has an image, set it
    if (suggestion.imageUrl) {
      setImageUrl(suggestion.imageUrl);
    }
    setSuggestions([]);
    // Mostrar la notificación
    showSuggestionNotification();
  };

  // Handle image upload
  const handleImageUploaded = (url) => {
    setImageUrl(url);
    setNewProduct({
      ...newProduct,
      imageUrl: url
    });
  };

    return(
        <div className="modal">

        {isLoading && LoadingComponent}
        <form onSubmit={handleSubmit} className="modalContent">
          <h3 className="subtitle">Nuevo Producto</h3>
          
          <div className="formGroup">
            <label className="label">Nombre del producto</label>
            <input
              type="text"
              //this in is broken after chosing a recommendation, it doesn't work after chosing a product
              value={newProduct.name}
              onChange={handleNameChange}
              className="input"
            />
            {suggestions.length > 0 && (
              <div className="suggestion-input--container">
                <div style={{width: '100%', height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <span style={{padding: '10px', backgroundColor: '#f3f3f3', width: '100%'}}>SUGERENCIAS DE AUTOCOMPLETADO</span>


                </div>


                <ul className="suggestion-input--list">
                      {suggestions.map((suggestion, index) => (
                        <li 
                          key={index} 
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="suggestion-input--item"
                        >
                          <span className="suggestion-input--name">{suggestion.name}</span>
                          <span className="suggestion-input--details">{suggestion.details}</span>
                          <span className="suggestion-input--price">${suggestion.price}</span>
                        </li>
                      ))}
                    </ul>
              </div>

            )}
          </div>

          {/* Image Upload Component - WhatsApp style */}
          <ImageUpload
            onImageUploaded={handleImageUploaded}
            existingImageUrl={imageUrl}
          />

          {['price', 'details', 'stock'].map(field => {
            // ✅ SECURITY: Only admin can modify stock
            const isStockField = field === 'stock';
            const isDisabled = isStockField && !isAdmin;

            return (
            <div key={field} className="formGroup">
              <label className="label">
                {field === 'price' ? 'Precio' :
                field === 'details' ? 'Detalles del producto' :
                field === 'stock' ? 'Cantidad en inventario' :
                field}
                {isDisabled && (
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '12px',
                    color: '#dc3545',
                    fontWeight: 'bold'
                  }}>
                    🔒 Solo Admin
                  </span>
                )}
              </label>
              {field === 'details' ? (
                <textarea
                  value={newProduct[field] || ''}
                  onChange={(e) => setNewProduct({
                    ...newProduct,
                    [field]: e.target.value
                  })}
                  className="input"
                  placeholder="Descripción del producto, materiales, etc."
                  rows={3}
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    type={field === 'price' || field === 'stock' ? 'number' : 'text'}
                    value={newProduct[field] || ''}
                    onChange={(e) => setNewProduct({
                      ...newProduct,
                      [field]: e.target.value
                    })}
                    className="input"
                    required={!isDisabled}
                    disabled={isDisabled}
                    style={{
                      backgroundColor: isDisabled ? '#f5f5f5' : 'white',
                      cursor: isDisabled ? 'not-allowed' : 'text',
                      opacity: isDisabled ? 0.6 : 1
                    }}
                    title={isDisabled ? 'Solo el administrador puede modificar el stock' : ''}
                  />
                  {isDisabled && (
                    <div style={{
                      marginTop: '4px',
                      fontSize: '11px',
                      color: '#6c757d',
                      fontStyle: 'italic'
                    }}>
                      El stock solo puede ser modificado por el administrador para prevenir irregularidades
                    </div>
                  )}
                </div>
              )}
            </div>
          );
          })}

          <div className="buttonGroup">
             <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              style={{ backgroundColor: 'red', color: '#fff' }}
              className="button"
            >
              Salir
            </button>


            <button type="submit" className="button">
              Guardar
            </button>
           
          </div>
        </form>
      </div>
    )
}

export default ProductFormModal;