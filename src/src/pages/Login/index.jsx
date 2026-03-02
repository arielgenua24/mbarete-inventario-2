import { useState } from "react";
import { login } from "../../services/authService";
import useFirestoreContext from "../../hooks/useFirestoreContext";
import { useNavigate } from "react-router-dom";
import "./styles.css";
import { Eye, EyeOff } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { setUser } = useFirestoreContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const newUser = await login(email, password);
      setUser(email);
      if (newUser) {
        navigate('/home');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <h2 className="login-title">Iniciar Sesión</h2>
      <form className="login-form" onSubmit={handleLogin}>
        <input
          className="login-input"
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="login-password-container">
          <input
            className="login-input"
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
         <button
          type="button"
          className="login-password-toggle"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <EyeOff size={20} color="#0E93FF" /> : <Eye size={20} color="#0E93FF" />}
        </button>
        </div>
        <button className="login-button" type="submit">Iniciar Sesión</button>
      </form>
      {error && <p className="login-error">{error}</p>}
    </div>
  );
};

export default Login;
