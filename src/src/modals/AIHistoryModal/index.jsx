import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { db } from '../../firebaseSetUp';
import { doc, getDoc } from 'firebase/firestore';
import './styles.css';

const STORAGE_KEY = 'ai-upload-history';

export const saveSessionToHistory = (products) => {
  const existing = getHistory();
  const session = {
    id: Date.now(),
    label: `Sesión ${existing.length + 1}`,
    timestamp: new Date().toISOString(),
    products,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([session, ...existing].slice(0, 20)));
};

export const getHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

// Fetch imageUrls for a list of product IDs from Firestore
const fetchImages = async (products) => {
  const results = {};
  await Promise.all(
    products.map(async (p) => {
      try {
        const snap = await getDoc(doc(db, 'products', p.id));
        if (snap.exists()) {
          results[p.id] = snap.data().imageUrl || null;
        }
      } catch {
        results[p.id] = null;
      }
    })
  );
  return results;
};

const AIHistoryModal = ({ isOpen, onClose }) => {
  const [sessions] = useState(() => getHistory());
  const [expandedId, setExpandedId] = useState(null);
  // { [sessionId]: { [productId]: imageUrl | null } }
  const [imageCache, setImageCache] = useState({});
  const [loadingSession, setLoadingSession] = useState(null);
  const navigate = useNavigate();

  // When a session is expanded, fetch fresh images from Firestore
  useEffect(() => {
    if (!expandedId) return;
    if (imageCache[expandedId]) return; // already fetched

    const session = sessions.find((s) => s.id === expandedId);
    if (!session) return;

    setLoadingSession(expandedId);
    fetchImages(session.products).then((imgs) => {
      setImageCache((prev) => ({ ...prev, [expandedId]: imgs }));
      setLoadingSession(null);
    });
  }, [expandedId, sessions, imageCache]);

  if (!isOpen) return null;

  const handleEdit = (productId) => {
    onClose();
    navigate(`/product/${productId}`);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const toggleSession = (sessionId) => {
    setExpandedId(expandedId === sessionId ? null : sessionId);
  };

  return (
    <div className="aih-overlay" onClick={onClose}>
      <div className="aih-dialog" onClick={(e) => e.stopPropagation()}>

        <div className="aih-drag-wrap">
          <div className="aih-drag-handle" />
        </div>

        <div className="aih-header">
          <div>
            <h2 className="aih-title">Historial de cargas</h2>
            <p className="aih-subtitle">{sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} guardada{sessions.length !== 1 ? 's' : ''}</p>
          </div>
          <button className="aih-close" onClick={onClose}>✕</button>
        </div>

        <div className="aih-list">
          {sessions.length === 0 && (
            <div className="aih-empty">
              <p>Todavía no hay sesiones guardadas.</p>
            </div>
          )}

          {sessions.map((session) => {
            const isExpanded = expandedId === session.id;
            const imgs = imageCache[session.id] || {};
            const isLoadingImgs = loadingSession === session.id;

            // Count how many have images in this session (from cache)
            const withImage = Object.values(imgs).filter(Boolean).length;
            const total = session.products.length;

            return (
              <div key={session.id} className="aih-session">
                <button
                  className="aih-session-header"
                  onClick={() => toggleSession(session.id)}
                >
                  <div className="aih-session-info">
                    <span className="aih-session-label">{session.label}</span>
                    <span className="aih-session-meta">
                      {formatDate(session.timestamp)} · {total} producto{total !== 1 ? 's' : ''}
                      {imageCache[session.id] && (
                        <span className={`aih-img-badge ${withImage === total ? 'complete' : withImage > 0 ? 'partial' : 'none'}`}>
                          {withImage === total ? ' · ✓ Todas con foto' : ` · ${withImage}/${total} con foto`}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className={`aih-chevron ${isExpanded ? 'open' : ''}`}>›</span>
                </button>

                {isExpanded && (
                  <div className="aih-products">
                    {isLoadingImgs ? (
                      <div className="aih-imgs-loading">Cargando imágenes...</div>
                    ) : (
                      session.products.map((product) => {
                        const imageUrl = imgs[product.id];
                        return (
                          <div key={product.id} className="aih-product-item">
                            <div className="aih-product-thumb">
                              {imageUrl ? (
                                <img src={imageUrl} alt={product.name} className="aih-product-img" />
                              ) : (
                                <div className="aih-product-placeholder">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="3" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="aih-product-info">
                              <span className="aih-product-name">{product.name}</span>
                              <span className="aih-product-meta">
                                ${product.price?.toLocaleString('es-AR')}
                                {product.sizes?.length > 0 && ` · T. ${product.sizes[0]}`}
                                {product.category && ` · ${product.category}`}
                              </span>
                              {!imageUrl && (
                                <span className="aih-no-img-hint">Sin foto</span>
                              )}
                            </div>
                            <button
                              className="aih-edit-btn"
                              onClick={() => handleEdit(product.id)}
                            >
                              {imageUrl ? 'Editar' : '+ Foto'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="aih-footer">
          <button className="aih-done-btn" onClick={onClose}>Cerrar</button>
        </div>

      </div>
    </div>
  );
};

AIHistoryModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AIHistoryModal;
