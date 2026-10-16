import { createRoot } from 'react-dom/client';
import { DuckGame } from './components/duck-game';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(<DuckGame />);
