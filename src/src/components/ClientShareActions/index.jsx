import { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import './styles.css';

/**
 * Componente para compartir orden con el cliente
 * - Genera QR que apunta a /mi-compra/:orderId
 * - Envía link por WhatsApp
 */
function ClientShareActions({ order, variant = 'full' }) {
  const [showQRModal, setShowQRModal] = useState(false);
  const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Obtener el orderId correcto
  const orderId = order?.orderId || order?.id;
  const orderCode = order?.orderCode || orderId?.slice(-8).toUpperCase();

  // Generar URL pública para el cliente
  const getPublicUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/#/mi-compra/${orderId}`;
  };

  // Formatear número de teléfono argentino
  const formatArgentinePhone = (phone) => {
    // Limpiar el número
    let cleaned = phone.replace(/\D/g, '');

    // Si empieza con 0, quitarlo
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Si no tiene código de país, agregar 54
    if (!cleaned.startsWith('54')) {
      cleaned = '54' + cleaned;
    }

    // Si tiene 54 pero le falta el 9 para móviles
    if (cleaned.startsWith('54') && !cleaned.startsWith('549') && cleaned.length >= 12) {
      cleaned = '549' + cleaned.substring(2);
    }

    return cleaned;
  };

  // Abrir WhatsApp con el link
  const handleSendWhatsApp = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();

      if (!phoneNumber.trim()) {
        alert('Por favor ingresa un número de teléfono');
        return;
      }

      const formattedPhone = formatArgentinePhone(phoneNumber);
      const publicUrl = getPublicUrl();
      const message = encodeURIComponent(
        `¡Hola! Aquí está el detalle de tu compra en Mbarete:\n\n` +
        `Código: ${orderCode}\n` +
        `Ver compra: ${publicUrl}\n\n` +
        `¡Gracias por tu compra!`
      );

      window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
      setShowWhatsAppInput(false);
      setPhoneNumber('');
    }
  };

  // Copiar link al portapapeles
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getPublicUrl());
      alert('¡Link copiado!');
    } catch (err) {
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = getPublicUrl();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('¡Link copiado!');
    }
  };

  if (!orderId) return null;

  // Variante compacta para la lista de órdenes
  if (variant === 'compact') {
    return (
      <>
        <div className="share-actions-compact">
          <button
            className="share-btn-compact share-btn-qr"
            onClick={() => setShowQRModal(true)}
            title="Generar QR para cliente"
          >
            <span className="share-btn-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="3" height="3"/>
                <rect x="18" y="14" width="3" height="3"/>
                <rect x="14" y="18" width="3" height="3"/>
                <rect x="18" y="18" width="3" height="3"/>
              </svg>
            </span>
            <span className="share-btn-text">QR para cliente</span>
          </button>
          <button
            className="share-btn-compact share-btn-wa"
            onClick={() => setShowWhatsAppInput(!showWhatsAppInput)}
            title="Enviar por WhatsApp"
          >
            <span className="share-btn-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.570-.01-.198 0-.520.074-.792.372-.272.297-1.040 1.016-1.040 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.200 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.360.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.570-.347m-5.421 7.403h-.004a9.870 9.870 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.860 9.860 0 01-1.510-5.260c.001-5.450 4.436-9.884 9.888-9.884 2.640 0 5.122 1.030 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.450-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.050 0C5.495 0 .160 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.480-8.413z"/>
              </svg>
            </span>
            <span className="share-btn-text">WhatsApp cliente</span>
          </button>
        </div>

        {/* Input de WhatsApp flotante */}
        {showWhatsAppInput && (
          <div className="whatsapp-input-floating">
            <span className="whatsapp-floating-title">Número del cliente</span>
            <input
              type="tel"
              placeholder="Ej: 11 1234-5678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={handleSendWhatsApp}
              autoFocus
            />
            <div className="whatsapp-floating-actions">
              <button className="send-wa-floating-btn" onClick={handleSendWhatsApp}>
                Enviar por WhatsApp
              </button>
              <button className="close-btn" onClick={() => setShowWhatsAppInput(false)}>
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Modal QR */}
        {showQRModal && (
          <div className="qr-modal-overlay" onClick={() => setShowQRModal(false)}>
            <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="qr-modal-close" onClick={() => setShowQRModal(false)}>×</button>

              <div className="qr-modal-header">
                <h3>QR para el cliente</h3>
                <p>El cliente puede escanear este código para ver su compra</p>
              </div>

              <div className="qr-code-container">
                <QRCodeCanvas
                  value={getPublicUrl()}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="qr-order-code">
                Código: <strong>{orderCode}</strong>
              </div>

              <div className="qr-modal-actions">
                <button className="qr-action-btn copy" onClick={copyLink}>
                  📋 Copiar link
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Variante full para succeeded-order
  return (
    <div className="share-actions-container">
      <h3 className="share-title">Compartir con el cliente</h3>

      {/* Botón QR */}
      <button
        className="share-action-btn qr-btn"
        onClick={() => setShowQRModal(true)}
      >
        <div className="btn-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="3" height="3"/>
            <rect x="18" y="14" width="3" height="3"/>
            <rect x="14" y="18" width="3" height="3"/>
            <rect x="18" y="18" width="3" height="3"/>
          </svg>
        </div>
        <div className="btn-content">
          <span className="btn-label">Generar QR para cliente</span>
          <span className="btn-description">El cliente escanea y ve su compra</span>
        </div>
        <div className="btn-arrow">›</div>
      </button>

      {/* Sección WhatsApp */}
      <div className="whatsapp-section">
        <div className="whatsapp-header">
          <div className="wa-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="wa-text">
            <span className="wa-title">¿El cliente no puede escanear?</span>
            <span className="wa-subtitle">Enviar link por WhatsApp</span>
          </div>
        </div>

        <div className="whatsapp-input-container">
          <div className="phone-prefix">+54</div>
          <input
            type="tel"
            placeholder="11 1234-5678"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            onKeyDown={handleSendWhatsApp}
            className="phone-input"
          />
        </div>
        <button
          className="send-wa-btn send-wa-btn-block"
          onClick={handleSendWhatsApp}
        >
          Enviar por WhatsApp
        </button>
        <p className="whatsapp-hint">Presiona Enter o click en Enviar para abrir WhatsApp</p>
      </div>

      {/* Modal QR */}
      {showQRModal && (
        <div className="qr-modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={() => setShowQRModal(false)}>×</button>

            <div className="qr-modal-header">
              <h3>QR para el cliente</h3>
              <p>El cliente puede escanear este código para ver su compra</p>
            </div>

            <div className="qr-code-container">
              <QRCodeCanvas
                value={getPublicUrl()}
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="qr-order-code">
              Código: <strong>{orderCode}</strong>
            </div>

            <div className="qr-modal-actions">
              <button className="qr-action-btn copy" onClick={copyLink}>
                📋 Copiar link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientShareActions;
