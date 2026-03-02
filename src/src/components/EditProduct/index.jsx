import { useNavigate } from "react-router-dom"

// eslint-disable-next-line react/prop-types
function EditProductBtn({product_id}) {
    const navigate = useNavigate()

    return (
        <button
        style={{backgroundColor: "#fff", border: "3px solid #f3f3f3"}}
        className="navigateButton"
        onClick={() => navigate(`/product/${product_id}`)}
    >
        EDITAR
    </button>
    )
    
}

export default EditProductBtn