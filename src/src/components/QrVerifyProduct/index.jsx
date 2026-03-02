import QrScanner from "../QrScanner";
import beep_sound from "../../assets/sounds/beep_sound.mp3";
import "./styles.css";

const QrVerifyProduct = ({handleVerify, setisSearchByQrEnabled}) => {

  const handleScan = (data) => {
    console.log("Datos escaneados:", data);
    const parsedData = JSON.parse(data);
    const audio = new Audio(beep_sound);  // Ruta de tu archivo de sonido
    audio.play();
    console.log(parsedData.id);
    handleVerify(parsedData.id);
    return parsedData;

        

};

  return (
    <div className="qr-modal-overlay">
      <div className="qr-modal-content">
      <button className="qr-modal-close"
            onClick={() => {setisSearchByQrEnabled(false)}}
        > 
            X
        </button>

        <div className="qr-modal-header">
          <h1>Escanea un código QR</h1>
        </div>
        <div className="qr-scanner-container">
          <QrScanner 
            onScan={handleScan}
            className="qr-scanner"
          />
        </div>
       


      </div>
    </div>
  );
};

export default QrVerifyProduct;