import { createRoot } from 'react-dom/client';
import { DuckGame } from './components/duck-game';
import './app/globals.css';

const path = window.location.pathname.replace(/\/+$/, '');
const mode = path.endsWith('/pinball')
  ? 'pinball'
  : path.endsWith('/3d')
    ? 'marbles'
    : 'classic';
createRoot(document.getElementById('root')!).render(<DuckGame mode={mode} />);
