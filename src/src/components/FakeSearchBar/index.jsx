import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import './styles.css';

/**
 * FakeSearchBar - A clickable search bar that redirects to the full search page
 * Designed in Airbnb style to match the search page experience
 */
function FakeSearchBar({ placeholder = "Buscar productos..." }) {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate('/search');
    };

    return (
        <div className="fake-search-container" onClick={handleClick}>
            <div className="fake-search-bar">
                <Search className="fake-search-icon" size={20} />
                <span className="fake-search-placeholder">{placeholder}</span>
            </div>
        </div>
    );
}

export default FakeSearchBar;
