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
    const pdf = new jsPDF();
    const canvases = document.querySelectorAll('.qr-canvas');

    if (orderCode) {
      const productsByOrder = await getProductsByOrder(QRcode.id);

      // ... código existente para detalles del pedido y QR ...
      let yPos = 10;
      const detailLines = [
        `FECHA: ${QRcode.fecha}`,
        `Pedido de: ${QRcode.cliente}`,
        `Dirección: ${QRcode.direccion}`,
        `Teléfono: ${QRcode.telefono}`,
        `Código de Pedido: ${QRcode.orderCode}`,

      ];

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(15, yPos + 10, detailLines[0]);
      detailLines.slice(1).forEach((line, lineIndex) => {
        pdf.text(15, yPos + 17 + (lineIndex * 6), line);
      });

      const imgData = canvases[0].toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 150, yPos + 20, 40, 40);

      // Posición inicial después del QR y detalles
      yPos = 70 + 40; // 70 (final del QR) + 40px de margen

      // Estilo para sección de productos
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 51, 102); // Azul corporativo
      pdf.text(15, yPos, 'PRODUCTOS COMPRADOS');
      yPos += 15;

      // Contenedor principal de productos
      pdf.setTextColor(0, 51, 102); // Azul corporativo
      pdf.setLineWidth(0.5);

      productsByOrder.forEach((product) => {
        // Agregar página nueva si es necesario
        if (yPos > 250) {
          pdf.addPage();
          yPos = 20;
        }

        // Tarjeta de producto
        pdf.rect(15, yPos, 180, 30); // Borde del contenedor

        // Encabezado del producto
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 51, 102); // Azul corporativo
        pdf.setLineWidth(0.5);
        pdf.text(20, yPos + 8, product.productSnapshot.name);

        // Detalles en 2 columnas
        const col1 = 20;
        const col2 = 110;

        // Columna izquierda
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(col1, yPos + 16, `Detalles: ${product.productSnapshot.details || 'Sin detalles'}`);
        // Show selected variants if they exist
        if (product.selectedVariants?.color) {
          pdf.text(col1, yPos + 22, `Color: ${product.selectedVariants.color}`);
        }
        if (product.selectedVariants?.size) {
          pdf.text(col1, yPos + (product.selectedVariants?.color ? 28 : 22), `Talla: ${product.selectedVariants.size}`);
        }

        // Columna derecha
        pdf.text(col2, yPos + 16, `Precio unitario: $${formatPrice(product.productSnapshot.price)}`);
        pdf.text(col2, yPos + 22, `Cantidad: ${product.stock}`);

        // Línea separadora
        pdf.setDrawColor(200, 200, 200);
        pdf.line(15, yPos + 28, 195, yPos + 28);

        // Código de producto
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.text(18, yPos + 26, `SKU: ${product.productSnapshot.productCode}`);

        yPos += 35; // Espacio entre productos
      });

      // Calcular total
      const total = productsByOrder.reduce((sum, product) => {
        return sum + (Number(product.productSnapshot.price) * product.stock);
      }, 0);

      // Espacio después de productos
      yPos += 20;

      // Sección Total
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(26, 35, 126); // Azul oscuro elegante
      pdf.text(15, yPos, `TOTAL: $${formatPrice(total)}`);

      // Línea decorativa
      pdf.setDrawColor(189, 189, 189); // Gris suave
      pdf.line(15, yPos + 8, 195, yPos + 8);

      // Mensaje de agradecimiento
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(216, 27, 96); // Rosa chic
      pdf.text(
        "Gracias por comprar en Reina Chura Confecciones",
        pdf.internal.pageSize.width / 2,
        yPos + 25,
        { align: 'center' }
      );


      // Función para formatear precios
      function formatPrice(price) {
        return Number(price).toLocaleString('es-AR');
      }
    } else {
      // Sin orderCode: queremos 12 QR organizados en 4 filas x 3 columnas
      const columns = 3;       // 3 columnas
      const cellWidth = 60;    // Ancho de cada celda
      const cellHeight = 60;   // Alto de cada celda
      const marginX = 10;      // Margen horizontal
      const marginY = 10;      // Margen vertical

      canvases.forEach((c, index) => {
        const col = index % columns;             // Columna: 0, 1, 2
        const row = Math.floor(index / columns);   // Fila: 0 a 3 (4 filas en total)
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
    }

    pdf.save('Etiquetas-QR.pdf');
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
