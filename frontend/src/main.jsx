import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { HelmetProvider } from "react-helmet-async";
import App from './App';
import { SystemAlertProvider } from './components/ui/SystemAlert';
import './index.css';

const accentColor = import.meta.env.VITE_ACCENT_COLOR || '#ff315c';
document.documentElement.style.setProperty('--dc-accent', accentColor);
    
createRoot(document.getElementById('root')).render(
    <HelmetProvider>
        <BrowserRouter>
            <AuthProvider>
                <SystemAlertProvider>
                    <App />
                </SystemAlertProvider>
            </AuthProvider>
        </BrowserRouter>
    </HelmetProvider>
);
