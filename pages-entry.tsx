import { createRoot } from 'react-dom/client';
import { DuckGame } from './components/duck-game';
import './app/globals.css';

const is3d = window.location.pathname.replace(/\/+$/, '').endsWith('/3d');
createRoot(document.getElementById('root')!).render(
  <DuckGame mode={is3d ? 'marbles' : 'classic'} />,
);
