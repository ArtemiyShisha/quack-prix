'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Flag,
  Volume2,
  VolumeX,
  ArrowUpRight,
  Info,
  Waves,
  RotateCcw,
  Mic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { PinballTable } from '@/components/pinball-table';
import { DEFAULT_PINBALL_MAP, mapInfo } from '@/lib/pinball-maps';
import { DESCENT_RELEASE_AT, DESCENT_MAX_SECONDS } from '@/lib/pinball-descent';
import { useRace } from '@/hooks/use-race';
import {
  emptyRoster,
  parseRoster,
  STORAGE_KEY,
  type Member,
} from '@/lib/roster';
import { HUES } from '@/lib/track';
import { prepareSound, quack } from '@/lib/sound';
import { useGameTools } from '@/hooks/use-game-tools';
import { appUrl } from '@/lib/urls';

export function DuckGame() {
  const [sceneReady, setSceneReady] = useState(false);
  const [roster, setRoster] = useState<Member[]>(emptyRoster);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [error, setError] = useState('');
  const [sound, setSound] = useState(false);
  const selectedMap = mapInfo(DEFAULT_PINBALL_MAP);
  const race = useRace(sceneReady);
  const { setup, frame, countdown, running, paused } = race;
  const result = frame?.result;
  const winner = result && setup ? setup.members[result.slot] : null;
  const announced = useRef<number | null>(null);
  const count = roster.filter((p) => p.name.trim() && p.active).length;
  useEffect(() => {
    try {
      setRoster(parseRoster(localStorage.getItem(STORAGE_KEY)));
    } catch {
      setStorageOk(false);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
  }, [roster, loaded]);
  useEffect(() => {
    if (winner && setup && announced.current !== setup.sequence) {
      announced.current = setup.sequence;
      if (sound) quack();
    }
  }, [winner, setup, sound]);
  const edit = (id: number, patch: Partial<Member>) => {
    if (running) return;
    race.reset();
    setError('');
    setRoster((old) => old.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const start = () => {
    try {
      setError('');
      if (sound) {
        prepareSound();
        quack();
      }
      if (!sceneReady) throw new Error('Подожди, пока загрузится 3D-сцена.');
      return race.start(roster);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Не удалось начать раунд. Попробуй ещё раз.',
      );
      return null;
    }
  };
  useGameTools({
    roster,
    running,
    loaded,
    status: result ? 'finished' : running ? 'racing' : 'ready',
    winner: winner?.name ?? null,
    setRoster: (next) => {
      race.reset();
      setError('');
      setRoster(next);
    },
    start,
  });
  const status = paused
    ? !sceneReady
      ? 'Загрузка 3D — игра на паузе'
      : 'Пауза — вкладка неактивна'
    : winner
      ? 'Раунд завершён! Ведущий найден'
      : countdown
        ? `На старт… ${countdown}`
        : running
          ? 'Мультибол! Все участники в игре'
          : 'Кряк-машина готова — запускай шарики';
  const elapsed = frame?.elapsed ?? 0;
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href={appUrl('/')} aria-label="Кряк-при, главная">
          <img src={appUrl('/duck.png')} alt="" />
          <span>
            кряк-при<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-caption">Один раунд. Один ведущий.</div>
        <span className="edition">
          <span /> DAILY EDITION
        </span>
      </header>
      <main className="game-layout">
        <aside className="team-panel">
          <div className="eyebrow">СОБИРАЕМ СТАЮ</div>
          <div className="panel-title">
            <h1>Кто на дейлике?</h1>
            <span className="count-chip">{count}/8</span>
          </div>
          <p className="team-intro">
            Впиши имена и отметь, кто сегодня здесь. Победитель ведёт дейлик.
          </p>
          <div className="roster">
            {roster.map((member, index) => (
              <div
                className={`roster-row ${!member.active ? 'absent' : ''} ${winner?.id === member.id ? 'winner-row' : ''}`}
                key={member.id}
              >
                <span
                  className={`duck-avatar duck-${index}`}
                  aria-hidden="true"
                >
                  <img src={appUrl('/duck.png')} alt="" />
                </span>
                <Input
                  aria-label={`Участник ${index + 1}`}
                  disabled={running || !loaded}
                  maxLength={24}
                  placeholder={`Участник ${index + 1}`}
                  value={member.name}
                  onChange={(event) =>
                    edit(member.id, { name: event.target.value })
                  }
                />
                <Checkbox
                  className="attendance"
                  checked={member.active}
                  disabled={running || !member.name.trim()}
                  onCheckedChange={(active) => edit(member.id, { active })}
                  aria-label={`${member.name || `Участник ${index + 1}`} участвует`}
                />
              </div>
            ))}
          </div>
          <p className="saved-note">
            <span />
            {!loaded
              ? 'Вспоминаем стаю…'
              : storageOk
                ? 'Список сохранён в этом браузере'
                : 'Браузер не разрешил сохранить список'}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button
            className="start-button"
            disabled={count === 0 || running || !loaded || !sceneReady}
            onClick={start}
          >
            {result ? <RotateCcw size={19} /> : <Flag size={19} />}{' '}
            {running
              ? 'Шарики в игре…'
              : result
                ? 'Ещё один раунд'
                : 'Запустить мультибол'}{' '}
            <ArrowUpRight size={19} />
          </Button>
          <details className="fairness-details">
            <summary>
              <Info size={16} /> Как работает случайность
            </summary>
            <p>
              Все шарики начинают из покоя на одной высоте. Общая заслонка
              одновременно выпускает их на разгонную площадку трёхэтажной карты
              «Глубина». Грибки, роторы и возвратные пружины меняют их движение
              при контакте. Первые две лунки ведут на следующий этаж. Ведущего
              выбирает первое попадание в третью лунку — в ядре.
            </p>
            <p>
              Имена независимо перемешиваются по одинаковым шарикам. Фазы
              механизмов каждый раз новые, стартовые условия одинаковы для всех;
              физика не получает имён и мест. При одновременном финише
              сравниваем моменты пересечения. После {DESCENT_RELEASE_AT} секунд
              пружины отключаются, механизмы останавливаются и поднимаются, а на{' '}
              {DESCENT_MAX_SECONDS}-й секунде остаётся явно обозначенный
              резервный выбор по пройденному этажу и расстоянию до финиша.
            </p>
          </details>
          {running && (
            <p className="race-hint">
              Первые две лунки ведут на следующий этаж.
              <br />
              Победа — падение в лунку ядра.
            </p>
          )}
        </aside>
        <section className="race-panel" aria-label="Поле пинбола в 3D">
          <div className="race-heading">
            <div>
              <div className="eyebrow">ПИНБОЛ · МУЛЬТИБОЛ</div>
              <h2>
                Кряк-машина<span className="track-sticker">3D</span>
              </h2>
            </div>
            <div className="view-controls">
              <Button
                variant="ghost"
                className="sound-button"
                onClick={() => {
                  if (!sound) prepareSound();
                  setSound((v) => !v);
                }}
                aria-label={sound ? 'Выключить звук' : 'Включить звук'}
                aria-pressed={sound}
              >
                {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </Button>
            </div>
          </div>
          <p className="pinball-map-description">
            <strong>{selectedMap.name}.</strong> {selectedMap.description}
          </p>
          <div className="track-shell">
            <div className="track-status">
              <span className={`status-dot ${running ? 'live' : ''}`} />
              <span role="status">{status}</span>
              <span className="race-timer">
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
                {String(Math.floor(elapsed % 60)).padStart(2, '0')}
              </span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div style={{ width: result ? '100%' : '0%' }} />
            </div>
            <PinballTable
              members={setup?.members ?? roster}
              frame={frame}
              onReady={setSceneReady}
              sound={sound}
            />
            {countdown && (
              <div className="countdown" aria-hidden="true">
                <span>{countdown}</span>
                <p>Сейчас будет мультибол</p>
              </div>
            )}
            {winner && result && (
              <div className="pinball-result">
                <div className="winner-card" role="status">
                  <span className="winner-kicker">КРЯ! У НАС ЕСТЬ ВЕДУЩИЙ</span>
                  <img
                    src={appUrl('/duck.png')}
                    alt="Победившая утка"
                    style={{ filter: `hue-rotate(${HUES[winner.id]}deg)` }}
                  />
                  <h3>{winner.name}</h3>
                  <p>
                    <Mic size={18} /> Сегодня микрофон твой.
                  </p>
                  <span className="winner-time">
                    {result.reason === 'distance'
                      ? 'Лимит времени — по этажу и близости к лунке'
                      : `Финиш за ${result.time.toFixed(1)} сек.`}
                  </span>
                  <Button
                    className="winner-again"
                    variant="secondary"
                    onClick={start}
                  >
                    <RotateCcw size={16} /> Ещё один раунд
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="race-footer">
            <span>
              <Waves size={17} /> {selectedMap.tagline}
            </span>
            <span>Все в игре до первого финиша</span>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span>Пусть судьба покрякает за вас.</span>
        <span>Сделано для команды, с утками.</span>
      </footer>
    </div>
  );
}
