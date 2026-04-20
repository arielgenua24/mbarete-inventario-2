import { QRCodeCanvas } from 'qrcode.react';
import { useState } from 'react';
import useFirestoreContext from '../../hooks/useFirestoreContext';
import jsPDF from 'jspdf';
import './styles.css';
import { set } from 'date-fns';
import html2canvas from 'html2canvas';
import { FaDownload, FaPrint, FaTimes } from 'react-icons/fa';

function QRmodal({ QRcode, setQRcode, orderCode }) {
  const { getOrderById, getProductsByOrder } = useFirestoreContext();
  const [productData, setProductData] = useState('');

  if (!QRcode) return 'error no hay ningun codigo QR';

  console.log(QRcode)


  const qrValue = orderCode
    ? JSON.stringify({ id: QRcode.id, code: QRcode.orderCode, estado: QRcode.estado })
    : JSON.stringify({ id: QRcode.id, code: QRcode.productCode });

  console.log(qrValue)


  const downloadPDF = async () => {
    const canvases = document.querySelectorAll('.qr-canvas');

    if (orderCode) {
      function formatPrice(price) {
        return Number(price).toLocaleString('es-AR');
      }

      const productsByOrder = await getProductsByOrder(QRcode.id);
      const total = productsByOrder.reduce((sum, p) => sum + (Number(p.productSnapshot.price) * p.stock), 0);

      const qrCanvas = canvases[0];
      const qrDataUrl = qrCanvas ? qrCanvas.toDataURL('image/png') : '';

      const productRows = productsByOrder.map(p => {
        const variantParts = [];
        if (p.selectedVariants?.color) variantParts.push(`Color: ${p.selectedVariants.color}`);
        if (p.selectedVariants?.size) variantParts.push(`Talle: ${p.selectedVariants.size}`);
        const variantText = variantParts.join(' · ') || (p.productSnapshot.details || '');
        const lineTotal = Number(p.productSnapshot.price) * p.stock;
        return `
          <tr>
            <td style="padding:14px 12px;vertical-align:top;border-bottom:1px solid #e5e5e5;">
              <div style="font-size:14px;font-weight:600;color:#3a3835;line-height:1.3;margin-bottom:3px;">${p.productSnapshot.name}</div>
              ${variantText ? `<div style="font-size:12px;color:#999;line-height:1.4;">${variantText}</div>` : ''}
              <span style="display:inline-block;margin-top:5px;background:#f5f4f2;border:1px solid #e5e5e5;border-radius:4px;padding:2px 7px;font-family:monospace;font-size:10px;color:#5a5a5a;">#${p.productSnapshot.productCode}</span>
            </td>
            <td style="padding:14px 12px;font-size:14px;color:#5a5a5a;border-bottom:1px solid #e5e5e5;vertical-align:top;">${p.selectedVariants?.size || 'Sin talle'}</td>
            <td style="padding:14px 12px;font-size:14px;font-weight:500;color:#5a5a5a;text-align:center;border-bottom:1px solid #e5e5e5;vertical-align:top;">${p.stock}</td>
            <td style="padding:14px 12px;font-size:14px;font-weight:500;color:#5a5a5a;text-align:right;border-bottom:1px solid #e5e5e5;vertical-align:top;">$${formatPrice(p.productSnapshot.price)}</td>
            <td style="padding:14px 12px;font-size:14px;font-weight:700;color:#3a3835;text-align:right;border-bottom:1px solid #e5e5e5;vertical-align:top;">$${formatPrice(lineTotal)}</td>
          </tr>`;
      }).join('');

      const subtotal = total;

      const invoiceHTML = `
        <div style="width:794px;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;border-radius:6px;">

          <!-- HEADER -->
          <div style="background:#efefef;padding:28px 36px;display:flex;align-items:center;justify-content:space-between;gap:24px;">
            <div style="display:flex;flex-direction:column;gap:4px;">
              <div style="font-size:30px;font-weight:700;color:#000;letter-spacing:-0.5px;line-height:1;">Mbar<span style="color:#e07b2a;">e</span>te</div>
              <div style="font-size:11px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:#969696;margin-top:2px;">Comprobante de compra</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#404040;font-weight:500;">Código de Pedido</div>
              <div style="font-family:monospace;font-size:15px;color:#282828;font-weight:500;margin-top:3px;">${QRcode.orderCode}</div>
              <div style="font-size:12px;color:#2c2c2c;margin-top:2px;">${QRcode.fecha}</div>
            </div>
          </div>

          <!-- ORANGE BAND -->
          <div style="height:3px;background:linear-gradient(90deg,#e07b2a 0%,#f5c87a 50%,#e07b2a 100%);"></div>

          <!-- CLIENT + QR -->
          <div style="padding:28px 36px;display:grid;grid-template-columns:1fr auto;gap:32px;align-items:start;border-bottom:1px solid #e5e5e5;background:#fafaf9;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;">
              <div style="display:flex;flex-direction:column;gap:2px;">
                <span style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#999;">Cliente</span>
                <span style="font-size:14px;font-weight:500;color:#3a3835;">${QRcode.cliente || 'Cliente sin nombre'}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:2px;">
                <span style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#999;">Teléfono</span>
                <span style="font-size:14px;font-weight:500;color:#3a3835;">${QRcode.telefono || 'Sin teléfono'}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:2px;grid-column:1/-1;">
                <span style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#999;">Dirección de entrega</span>
                <span style="font-size:14px;font-weight:500;color:#3a3835;">${QRcode.direccion || 'Sin dirección'}</span>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
              ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:88px;height:88px;display:block;border:1px solid #e5e5e5;border-radius:6px;padding:4px;background:#fff;" />` : ''}
              <div style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#999;text-align:center;">Escanear pedido</div>
            </div>
          </div>

          <!-- PRODUCTS -->
          <div style="padding:0 36px 28px;">
            <div style="display:flex;align-items:center;gap:10px;padding:20px 0 14px;border-bottom:1.5px solid #2c2a26;margin-bottom:0;">
              <div style="width:6px;height:6px;background:#e07b2a;border-radius:50%;flex-shrink:0;"></div>
              <h2 style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2c2a26;margin:0;">Productos comprados</h2>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#fff;border-bottom:1px solid #e5e5e5;">
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#999;text-align:left;width:42%;">Producto</th>
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#999;text-align:left;width:22%;">Talle</th>
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#999;text-align:center;width:12%;">Cant.</th>
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#999;text-align:right;width:12%;">P. Unit.</th>
                  <th style="padding:10px 12px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#999;text-align:right;width:12%;">Total</th>
                </tr>
              </thead>
              <tbody>${productRows}</tbody>
            </table>
          </div>

          <!-- TOTALS -->
          <div style="display:flex;justify-content:flex-end;padding:20px 36px 28px;border-top:1px solid #e5e5e5;background:#fafaf9;">
            <div style="width:260px;display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:12px;color:#999;font-weight:500;">Subtotal</span>
                <span style="font-size:12px;color:#5a5a5a;font-weight:500;">$${formatPrice(subtotal)}</span>
              </div>
              <div style="border-top:1.5px solid #2c2a26;margin-top:6px;padding-top:10px;display:flex;justify-content:space-between;align-items:baseline;">
                <span style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#2c2a26;">Total</span>
                <span style="font-size:22px;font-weight:700;color:#2c2a26;line-height:1;">$${formatPrice(total)}</span>
              </div>
            </div>
          </div>

          <!-- FOOTER -->
          <div style="background:#efefef;padding:20px 36px;display:flex;align-items:center;justify-content:space-between;gap:20px;">
            <div style="font-size:13px;font-style:italic;color:#000;font-weight:400;">
              Gracias por comprar en <strong style="color:#000;font-style:normal;font-weight:600;">Mbarete</strong> — esperamos verte pronto.
            </div>
            <div style="font-size:10px;color:#000;letter-spacing:0.5px;text-align:right;line-height:1.5;">
              Documento generado automáticamente<br/>
              Conserve este comprobante
            </div>
          </div>

        </div>
      `;

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-1;';
      container.innerHTML = invoiceHTML;
      document.body.appendChild(container);

      try {
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: 794,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeightMm = (canvas.height / canvas.width) * pdfWidth;

        if (imgHeightMm <= pdfHeight) {
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeightMm);
        } else {
          // Multi-page if invoice is very long
          let yOffset = 0;
          const pageHeightPx = canvas.width * (pdfHeight / pdfWidth);
          while (yOffset < canvas.height) {
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = Math.min(pageHeightPx, canvas.height - yOffset);
            const ctx = pageCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, -yOffset);
            const pageData = pageCanvas.toDataURL('image/jpeg', 0.95);
            const pageImgH = (pageCanvas.height / pageCanvas.width) * pdfWidth;
            pdf.addImage(pageData, 'JPEG', 0, 0, pdfWidth, pageImgH);
            yOffset += pageHeightPx;
            if (yOffset < canvas.height) pdf.addPage();
          }
        }

        pdf.save(`Factura-${QRcode.orderCode || QRcode.id}.pdf`);
      } finally {
        document.body.removeChild(container);
      }

    } else {
      // Sin orderCode: 12 QR en 4 filas x 3 columnas
      const pdf = new jsPDF();
      const columns = 3;
      const cellWidth = 60;
      const cellHeight = 60;
      const marginX = 10;
      const marginY = 10;

      canvases.forEach((c, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const xPos = marginX + col * cellWidth;
        const yPos = marginY + row * cellHeight;

        pdf.setDrawColor(100);
        pdf.setLineWidth(0.7);
        pdf.rect(xPos, yPos, cellWidth, cellHeight, 'S');

        const qrSize = 40;
        const xQr = xPos + (cellWidth - qrSize) / 2;
        const yQr = yPos + (cellHeight - qrSize) / 2;

        const imgData = c.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', xQr, yQr, qrSize, qrSize);
      });

      pdf.save('Etiquetas-QR.pdf');
    }
  };


  const downloadImageForPrinter = async () => {
    const element = document.querySelector('.QR-modalContent .QR-item');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 3 });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = orderCode ? `QR-Orden-${QRcode.orderCode || ''}.png` : `QR-Producto-${QRcode.name || ''}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="QR-modalOverlay">
      <div className="QR-modalContent">
        <div className="QR-container">
          <div className="QR-buttons">
            <button className="QR-actionButton primary" onClick={downloadPDF}>
              <FaDownload style={{ marginRight: '8px' }} /> DESCARGAR PDF A4
            </button>
            <button className="QR-actionButton secondary" onClick={downloadImageForPrinter}>
              <FaPrint style={{ marginRight: '8px' }} /> IMAGEN MINI IMPRESORA
            </button>
            <button className="QR-actionButton danger" onClick={() => setQRcode(null)}>
              <FaTimes style={{ marginRight: '8px' }} /> Cerrar
            </button>
          </div>

          {orderCode ? ([...Array(1)].map((_, index) => (
            <div key={index} className="QR-item">
              <h4 className="QR-title">
                {`FECHA: ${QRcode.fecha} Pedido de: ${QRcode.cliente} Direccion: ${QRcode.direccion} Telefono: ${QRcode.telefono} Código: ${QRcode.orderCode}`}
              </h4>
              <QRCodeCanvas className="qr-canvas" value={qrValue} size={80} />
            </div>
          ))) : ([...Array(12)].map((_, index) => (
            <div key={index} className="QR-item">
              <h4 className="QR-title">
                {`Producto: ${QRcode.name}`}
              </h4>
              <p style={{ fontSize: '12px', color: '#666', margin: '5px 0' }}>
                {QRcode.details || 'Sin detalles'}
              </p>
              <QRCodeCanvas className="qr-canvas" value={qrValue} size={80} />
            </div>
          )))}
          {/*[...Array(3)].map((_, index) => (
            <div key={index} className="QR-item">
              <h4 className="QR-title">
                {orderCode
                  ? `FECHA: ${QRcode.fecha} Pedido de: ${QRcode.cliente} Direccion: ${QRcode.direccion} Telefono: ${QRcode.telefono} Código: ${QRcode.orderCode}`
                  : `Producto: ${QRcode.name}-${QRcode.color} Talle: ${QRcode.size} Precio: $${QRcode.price} Código: ${QRcode.productCode}`}
              </h4>
              <QRCodeCanvas className="qr-canvas" value={qrValue} size={80} />
            </div>
          )) */ }
        </div>

      </div>
    </div>
  );
}

export default QRmodal;
