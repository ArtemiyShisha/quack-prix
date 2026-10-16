import { createRoot } from 'react-dom/client';
import { DuckGame } from './components/duck-game';
import './app/globals.css';

const isPinball = window.location.pathname
  .replace(/\/+$/, '')
  .endsWith('/pinball');
const is3d = window.location.pathname.replace(/\/+$/, '').endsWith('/3d');
const isCurling = window.location.pathname
  .replace(/\/+$/, '')
  .endsWith('/curling');
const isIce = window.location.pathname.replace(/\/+$/, '').endsWith('/ice');
createRoot(document.getElementById('root')!).render(
  <DuckGame
    mode={
      isPinball
        ? 'pinball'
        : isIce
          ? 'ice'
          : isCurling
            ? 'curling'
            : is3d
              ? 'marbles'
              : 'classic'
    }
  />,
);
