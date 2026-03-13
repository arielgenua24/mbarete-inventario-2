import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import LoadingComponent from '../../components/Loading';
import './styles.css';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || "minimax/minimax-m2.5";
const OPENROUTER_ENDPOINT = import.meta.env.VITE_OPENROUTER_ENDPOINT || "https://openrouter.ai/api/v1/chat/completions";

const AIChatModal = ({
  isOpen,
  onClose,
  aiImageFile,
  aiImagePreviewUrl,
  onProductsDetected,
  addProduct
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectedProducts, setDetectedProducts] = useState([]);
  const [showProductsPreview, setShowProductsPreview] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [isOpen]);

  // Start conversation when modal opens with image
  useEffect(() => {
    if (isOpen && aiImageFile && messages.length === 0) {
      startInitialAnalysis();
    }
  }, [isOpen, aiImageFile]);

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  const getSystemPrompt = () => {
    return `Eres un asistente experto en extracción de productos de catálogos y capturas de pantalla de WhatsApp.

Tu objetivo es analizar imágenes de catálogos de productos y extraer la información relevante.

REGLAS IMPORTANTES:

1. Devuelve SOLO JSON válido cuando detectes productos.
2. El JSON debe tener esta estructura exacta:
   {
     "products": [
       { "name": "string", "price": number, "stock": 0, "details": "string", "sizes": [number_o_string], "category": "string" }
     ]
   }

3. STOCK: Siempre stock: 0. Nunca se incluye en capturas, no lo inventes.

4. PRECIOS: Si aparecen 2 precios para el mismo producto, uno está tachado (precio anterior). Usar siempre el precio más bajo.

5. TALLES — REGLA MÁS IMPORTANTE:
   CADA TALLE ES UN PRODUCTO SEPARADO EN EL ARRAY. NUNCA juntes talles en un solo objeto.
   - "Super Baggy Nevado 38/40/42/44" → 4 objetos separados, cada uno con sizes: [38], sizes: [40], sizes: [42], sizes: [44]
   - Rango "38 al 46" → de 2 en 2: 38, 40, 42, 44, 46 → 5 objetos separados
   - Lista con barra final "40/42/44/" → ignorar barra final → 3 objetos: sizes:[40], sizes:[42], sizes:[44]
   - Letras "M L XL" → 3 objetos: sizes:["M"], sizes:["L"], sizes:["XL"]
   - Si es ambiguo, NO inventes. Pregunta al usuario.

6. CATEGORÍAS — usar EXACTAMENTE uno de estos valores (respeta mayúsculas y tildes):
   - "jean"       → pantalón jean clásico, skinny, slim, recto, chino, mom, cargo
   - "baggy"      → pantalón baggy, wide leg, oversized
   - "bermuda"    → bermuda, short, pantaloneta
   - "joggers"    → jogger, jogging
   - "parachutte" → pantalón paracaídas, parachutte
   - "frisa"      → pantalón de frisa, polar, térmica
   - "Camperas"   → campera, bomber, anorak, rompeviento (C MAYÚSCULA obligatoria)
   - "Chalecos"   → chaleco, vest (C MAYÚSCULA obligatoria)
   - "Nuevos"     → producto nuevo, lanzamiento (N MAYÚSCULA obligatoria)
   - "PocoStock"  → poco stock, últimas unidades (exactamente "PocoStock")
   - "ReIngreso"  → reingreso, vuelve al catálogo (exactamente "ReIngreso")
   - "Clásico"    → clásico, básico atemporal (exactamente "Clásico" con tilde)
   IMPORTANTE: Si no encaja en ninguna categoría, usar "jean" como valor por defecto.
   NUNCA usar: "jeans", "camperas" (minúscula), "pantalones", "remeras", "buzos", "shorts", "otros".

7. Si la imagen no es clara o falta información crítica, haz preguntas específicas. No uses JSON hasta tener todo claro.
8. Los productos se guardan automáticamente al recibirlos. Informá al usuario.

Ejemplo correcto para "Super Baggy Nevado 38/40/42/44 ARS 20000":
{ "products": [
  { "name": "super baggy nevado", "price": 20000, "stock": 0, "details": "", "sizes": [38], "category": "baggy" },
  { "name": "super baggy nevado", "price": 20000, "stock": 0, "details": "", "sizes": [40], "category": "baggy" },
  { "name": "super baggy nevado", "price": 20000, "stock": 0, "details": "", "sizes": [42], "category": "baggy" },
  { "name": "super baggy nevado", "price": 20000, "stock": 0, "details": "", "sizes": [44], "category": "baggy" }
] }`;
  };

  const startInitialAnalysis = async () => {
    if (!aiImageFile) return;

    setIsLoading(true);
    setIsStreaming(true);

    try {
      const dataUrl = await readFileAsDataUrl(aiImageFile);

      // Add initial user message with image
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: 'Analiza esta imagen de catálogo y extrae los productos que veas.',
        imageUrl: aiImagePreviewUrl,
        timestamp: new Date()
      };

      setMessages([userMessage]);

      const payload = {
        model: OPENROUTER_MODEL,
        temperature: 0.2,
        stream: true,
        messages: [
          { role: "system", content: getSystemPrompt() },
          {
            role: "user",
            content: [
              { type: "text", text: "Extrae los productos visibles en esta captura de catálogo." },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ]
      };

      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mbareté Inventory'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${await response.text()}`);
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let assistantMessageId = Date.now() + 1;

      // Add empty assistant message that will be filled progressively
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              
              if (content) {
                accumulatedContent += content;
                
                // Update the assistant message in real-time
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              }
            } catch {
              // Ignore parsing errors for malformed chunks
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ));

      // Try to parse JSON from the response and auto-save
      let parsedProducts = null;
      try {
        const jsonMatch = accumulatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.products && Array.isArray(parsed.products)) {
            parsedProducts = parsed.products;
          }
        }
      } catch {
        // No valid JSON found, continue conversation normally
      }

      if (parsedProducts) {
        await saveProductsToDatabase(parsedProducts);
      }

    } catch (error) {
      console.error('Error en análisis:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `❌ Error: ${error.message}. Por favor, intenta nuevamente.`,
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    setIsStreaming(true);

    try {
      // Build message history for the API
      const apiMessages = [
        { role: "system", content: getSystemPrompt() },
        ...messages.map(m => ({
          role: m.role,
          content: m.imageUrl 
            ? [
                { type: "text", text: m.content },
                { type: "image_url", image_url: { url: m.imageUrl } }
              ]
            : m.content
        })),
        { role: "user", content: inputMessage }
      ];

      const payload = {
        model: OPENROUTER_MODEL,
        temperature: 0.3,
        stream: true,
        messages: apiMessages
      };

      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mbareté Inventory'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let assistantMessageId = Date.now();

      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              
              if (content) {
                accumulatedContent += content;
                
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ));

      // Try to parse products from response
      try {
        const jsonMatch = accumulatedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.products && Array.isArray(parsed.products)) {
            setDetectedProducts(parsed.products);
            setShowProductsPreview(true);
          }
        }
      } catch {
        // Continue normally
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const saveProductsToDatabase = async (productsArg = null) => {
    const products = productsArg || detectedProducts;
    if (products.length === 0) return;

    setIsLoading(true);
    const savedProducts = [];
    let errors = [];

    for (const product of products) {
      try {
        const productId = await addProduct(
          product.name || 'Producto sin nombre',
          product.price || 0,
          product.details || '',
          product.stock || 0,
          null, // No image URL from AI extraction
          product.sizes || [],
          product.category || ''
        );
        savedProducts.push({
          id: productId,
          name: product.name || 'Producto sin nombre',
          price: product.price || 0,
          sizes: product.sizes || [],
          category: product.category || '',
        });
      } catch (error) {
        console.error('Error guardando producto:', error);
        errors.push(product.name || 'Producto desconocido');
      }
    }

    setIsLoading(false);

    const confirmMessage = {
      id: Date.now(),
      role: 'assistant',
      content: `✅ ${savedProducts.length} producto(s) guardado(s) automáticamente.${errors.length > 0 ? `\n❌ Errores en: ${errors.join(', ')}` : ''}`,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, confirmMessage]);
    setShowProductsPreview(false);
    setDetectedProducts([]);

    if (onProductsDetected) {
      onProductsDetected(savedProducts);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="ai-chat-modal-overlay" onClick={onClose}>
      <div className="ai-chat-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-chat-header">
          <div className="ai-chat-header-info">
            <div className="ai-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
            </div>
            <div className="ai-chat-title">
              <h3>Asistente IA</h3>
              <span className={`ai-status ${isStreaming ? 'typing' : ''}`}>
                {isStreaming ? 'Escribiendo...' : 'En línea'}
              </span>
            </div>
          </div>
          <button className="ai-chat-close" onClick={onClose}>×</button>
        </div>

        {/* Messages */}
        <div className="ai-chat-messages" ref={chatContainerRef}>
          {messages.length === 0 && (
            <div className="ai-chat-welcome">
              <div className="ai-avatar-large">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <p>Analizando tu imagen...</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`ai-message ${message.role === 'user' ? 'user' : 'assistant'} ${message.isError ? 'error' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="ai-message-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                </div>
              )}
              
              <div className="ai-message-content">
                {message.imageUrl && (
                  <div className="ai-message-image">
                    <img src={message.imageUrl} alt="Captura" />
                  </div>
                )}
                <div className="ai-message-bubble">
                  <p>{message.content}</p>
                  {message.isStreaming && (
                    <span className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </span>
                  )}
                </div>
                <span className="ai-message-time">{formatTime(message.timestamp)}</span>
              </div>
            </div>
          ))}

          {/* Products Preview */}
          {showProductsPreview && detectedProducts.length > 0 && (
            <div className="ai-products-preview">
              <div className="ai-products-header">
                <span>📦 Productos detectados ({detectedProducts.length})</span>
              </div>
              <div className="ai-products-list">
                {detectedProducts.map((product, idx) => (
                  <div key={idx} className="ai-product-item">
                    <div className="ai-product-info">
                      <strong>{product.name}</strong>
                      <span>${product.price} · Stock: {product.stock}</span>
                      {product.details && <small>{product.details}</small>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="ai-products-actions">
                <button 
                  className="ai-btn-save"
                  onClick={saveProductsToDatabase}
                  disabled={isLoading}
                >
                  {isLoading ? 'Guardando...' : '✓ Guardar en base de datos'}
                </button>
                <button 
                  className="ai-btn-cancel"
                  onClick={() => setShowProductsPreview(false)}
                  disabled={isLoading}
                >
                  Modificar
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="ai-chat-input-area">
          {isLoading && !isStreaming && (
            <div className="ai-chat-loading">
              <LoadingComponent isLoading={true} />
            </div>
          )}
          
          <div className="ai-chat-input-container">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe un mensaje..."
              disabled={isLoading}
              className="ai-chat-input"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="ai-chat-send"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

AIChatModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  aiImageFile: PropTypes.object,
  aiImagePreviewUrl: PropTypes.string,
  onProductsDetected: PropTypes.func,
  addProduct: PropTypes.func.isRequired
};

export default AIChatModal;
