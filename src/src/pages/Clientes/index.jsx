import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseSetUp';
import { Pencil, Tag, ArrowLeft, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './styles.css';

function normalizePhone(raw) {
  // Remove everything except digits
  const digits = raw.replace(/\D/g, '');
  // If already has country code 54, leave it; else prepend
  if (digits.startsWith('54')) return digits;
  // Argentine numbers: area code + number, typically 10 digits (e.g. 1112345678)
  return '54' + digits;
}

function buildWaUrl(phone, message) {
  const normalized = normalizePhone(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

const PROMO_MESSAGE =
  '¡Hola! Te escribimos desde Mbarete 👖 Tenemos nuevos jeans disponibles con precios especiales para vos. ¿Te interesa ver las novedades?';

export default function Clientes() {
  const navigate = useNavigate();
  const [step, setStep] = useState('choose'); // 'choose' | 'custom' | 'list'
  const [mode, setMode] = useState(null); // 'custom' | 'promo'
  const [customMessage, setCustomMessage] = useState('');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    if (selectedMode === 'promo') {
      fetchLeads();
      setStep('list');
    } else {
      setStep('custom');
    }
  };

  const handleCustomContinue = () => {
    if (!customMessage.trim()) return;
    fetchLeads();
    setStep('list');
  };

  const getMessage = () =>
    mode === 'promo' ? PROMO_MESSAGE : customMessage;

  const handleClientTap = (lead) => {
    if (!lead.whatsapp) return;
    const url = buildWaUrl(lead.whatsapp, getMessage());
    window.open(url, '_blank');
  };

  return (
    <div className="clientes-page">
      <header className="clientes-header">
        <button className="clientes-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="clientes-title">Clientes</h1>
      </header>

      {/* Step: choose mode */}
      {step === 'choose' && (
        <div className="clientes-modal-overlay">
          <div className="clientes-modal">
            <h2 className="clientes-modal-title">¿Qué querés hacer?</h2>
            <button
              className="clientes-modal-btn custom"
              onClick={() => handleModeSelect('custom')}
            >
              <Pencil size={22} className="clientes-modal-icon" />
              <span>Enviarle un mensaje personalizado</span>
            </button>
            <button
              className="clientes-modal-btn promo"
              onClick={() => handleModeSelect('promo')}
            >
              <Tag size={22} className="clientes-modal-icon" />
              <span>Promocionar un nuevo producto</span>
            </button>
          </div>
        </div>
      )}

      {/* Step: write custom message */}
      {step === 'custom' && (
        <div className="clientes-modal-overlay">
          <div className="clientes-modal">
            <button className="clientes-modal-back" onClick={() => setStep('choose')}>
              <ArrowLeft size={18} /> Volver
            </button>
            <h2 className="clientes-modal-title">Tu mensaje</h2>
            <textarea
              className="clientes-modal-textarea"
              placeholder="Escribí el mensaje que querés enviar..."
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              rows={5}
              autoFocus
            />
            <button
              className="clientes-modal-confirm"
              onClick={handleCustomContinue}
              disabled={!customMessage.trim()}
            >
              Ver clientes
            </button>
          </div>
        </div>
      )}

      {/* Step: client list */}
      {step === 'list' && (
        <div className="clientes-list-container">
          <div className="clientes-message-preview">
            <MessageCircle size={16} />
            <span>{getMessage()}</span>
          </div>

          {loading ? (
            <div className="clientes-loading">Cargando clientes...</div>
          ) : leads.length === 0 ? (
            <div className="clientes-empty">Todavía no hay clientes registrados.</div>
          ) : (
            <ul className="clientes-list">
              {leads.map(lead => (
                <li
                  key={lead.id}
                  className="clientes-item"
                  onClick={() => handleClientTap(lead)}
                >
                  <div className="clientes-item-avatar">
                    {(lead.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="clientes-item-info">
                    <span className="clientes-item-name">{lead.name || 'Sin nombre'}</span>
                    <span className="clientes-item-phone">{lead.whatsapp}</span>
                    {lead.talle && (
                      <span className="clientes-item-talle">Talle {lead.talle}</span>
                    )}
                  </div>
                  <MessageCircle size={20} className="clientes-item-wpp" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
