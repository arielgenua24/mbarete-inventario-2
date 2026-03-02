import { QrCode } from "lucide-react";
import './styles.css';

// eslint-disable-next-line react/prop-types
const QRButton = ({ product, onQRGenerate, }) => {
  return (
    <div className={`QR-buttonContaine`}>
      <button
        className="QR-qrButton"
        type="button"
        onClick={() => onQRGenerate(product)}
      >
       <QrCode size="24" /> 
        Imprimir QR
      </button>
    </div>
  );
};

export default QRButton;
