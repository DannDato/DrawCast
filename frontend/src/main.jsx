import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

const accentColor = import.meta.env.VITE_ACCENT_COLOR || '#ff315c';
document.documentElement.style.setProperty('--dc-accent', accentColor);

createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>);
