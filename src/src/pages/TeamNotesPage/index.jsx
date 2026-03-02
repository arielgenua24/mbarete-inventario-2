import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TeamNotes from '../../components/TeamNotes';
import './styles.css';

function TeamNotesPage() {
  const navigate = useNavigate();

  return (
    <div className="team-notes-page">
      <div className="team-notes-page-header-shell">
        <div className="team-notes-page-header">
          <button className="back-button" onClick={() => navigate('/home')}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="page-title">Canal del equipo</h1>
            <p className="page-subtitle">Comunicación interna en tiempo real</p>
          </div>
        </div>
      </div>

      <div className="team-notes-page-content">
        <TeamNotes />
      </div>
    </div>
  );
}

export default TeamNotesPage;
