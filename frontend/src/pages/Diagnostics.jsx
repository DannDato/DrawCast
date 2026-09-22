import { Navigate } from 'react-router-dom';

export default function Diagnostics() {
    return <Navigate to="/app/settings?section=diagnostics" replace />;
}
