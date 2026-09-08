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
  Scan,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RaceTrack } from '@/components/race-track';
import { useRace } from '@/hooks/use-race';
import {
  emptyRoster,
  parseRoster,
  STORAGE_KEY,
  type Member,
} from '@/lib/roster';
import { HUES, FINISH_Y, POOL } from '@/lib/track';
import { FLUSH_SECONDS, MAX_SECONDS } from '@/lib/race';
import { prepareSound, quack } from '@/lib/sound';
import { useGameTools } from '@/hooks/use-game-tools';

export default function Home() {
  const [roster, setRoster] = useState<Member[]>(emptyRoster);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [error, setError] = useState('');
  const [sound, setSound] = useState(false);
  const [overview, setOverview] = useState(false);
  const race = useRace();
  const { setup, frame, countdown, running, paused } = race;
  const result = frame?.result;
  const winner = result && setup ? setup.members[result.slot] : null;
  const announced = useRef<number | null>(null);
  const count = roster.filter((p) => p.name.trim() && p.active).length;
  const progress = frame
    ? Math.min(
        100,
        Math.max(
          0,
          ((Math.max(...frame.ducks.map((d) => d.y)) - 94) / (FINISH_Y - 94)) *
            100,
        ),
      )
    : 0;
  const leader =
    frame && setup ? [...frame.ducks].sort((a, b) => b.y - a.y)[0] : null;
  const leaderMember = leader && setup ? setup.members[leader.slot] : null;
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
      setOverview(false);
      if (sound) {
        prepareSound();
        quack();
      }
      return race.start(roster);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Не удалось начать заезд. Попробуй ещё раз.',
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
    ? 'Пауза — вкладка неактивна'
    : winner
      ? 'Финиш! Ведущий найден'
      : countdown
        ? `На старт… ${countdown}`
        : frame?.flushing
          ? 'Большой смыв! Все заслонки открыты'
          : running
            ? frame && frame.elapsed - frame.chaos.at < 0.85
              ? frame.chaos.title
              : leader &&
                  leader.y > POOL.triggerY &&
                  leader.y < POOL.bottom + 50
                ? 'Водоворот даёт жару!'
                : leader?.boosted
                  ? `${leaderMember?.name ?? 'Утка'} ловит турбо!`
                  : `${leaderMember?.name ?? 'Утка'} вырывается вперёд`
            : 'Утки на старте';
  const elapsed = frame?.elapsed ?? 0;
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Кряк-при, главная">
          <img src="/duck.png" alt="" />
          <span>
            кряк-при<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-caption">Один заезд. Один ведущий.</div>
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
                <span className={`duck-avatar duck-${index}`}>
                  <img src="/duck.png" alt="" />
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
            disabled={count === 0 || running || !loaded}
            onClick={start}
          >
            {result ? <RotateCcw size={19} /> : <Flag size={19} />}{' '}
            {running
              ? 'Утки в пути…'
              : result
                ? 'Ещё один заезд'
                : 'Выпустить уток'}{' '}
            <ArrowUpRight size={19} />
          </Button>
          <details className="fairness-details">
            <summary>
              <Info size={16} /> Как работает случайность
            </summary>
            <p>
              Перед каждым заездом имена случайно распределяются по стартовым
              местам. Во время гонки каждые одну-две секунды случаются новые
              случайные залпы: одних уток подбрасывает, других разгоняет.
              Вертушки меняют направление, водоворот крутит поток. Все утки
              получают толчки по одинаковым случайным правилам. Они одинаковы по
              весу и размеру — кто первым пересечёт финиш, тот и ведущий.
            </p>
            <p>
              Повторная победа возможна. Если заезд затянулся, на{' '}
              {FLUSH_SECONDS}-й секунде открывается «Большой смыв». Если к{' '}
              {MAX_SECONDS}-й секунде никто не финишировал, ведущим станет тот,
              кто спустился дальше.
            </p>
          </details>
          {running && (
            <p className="race-hint">
              Можно болеть за свою.
              <br />
              Подталкивать экран бесполезно.
            </p>
          )}
        </aside>
        <section className="race-panel" aria-label="Гоночная трасса">
          <div className="race-heading">
            <div>
              <div className="eyebrow">ТРАССА 01 · УТИНЫЙ АКВАПАРК</div>
              <h2>
                Большой заплыв<span className="track-sticker">КРЯ!</span>
              </h2>
            </div>
            <div className="view-controls">
              <Button
                variant="ghost"
                className="overview-button"
                onClick={() => setOverview((v) => !v)}
                aria-pressed={overview}
              >
                {overview ? <Navigation size={17} /> : <Scan size={17} />}
                <span>{overview ? 'За утками' : 'Вся трасса'}</span>
              </Button>
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
              <div style={{ width: `${progress}%` }} />
            </div>
            <RaceTrack
              members={setup?.members ?? roster}
              frame={frame}
              overview={overview}
            />
            {countdown && (
              <div className="countdown" aria-hidden="true">
                <span>{countdown}</span>
                <p>Приготовились покрякать</p>
              </div>
            )}
            {winner && result && (
              <div className="winner-overlay">
                <div className="winner-card" role="status">
                  <span className="winner-kicker">КРЯ! У НАС ЕСТЬ ВЕДУЩИЙ</span>
                  <img
                    src="/duck.png"
                    alt="Победившая утка"
                    style={{ filter: `hue-rotate(${HUES[winner.id]}deg)` }}
                  />
                  <h3>{winner.name}</h3>
                  <p>
                    <Mic size={18} /> Сегодня микрофон твой.
                  </p>
                  <span className="winner-time">
                    {result.reason === 'finish'
                      ? `Финиш за ${result.time.toFixed(1)} сек.`
                      : 'Лимит времени — победа по дистанции'}
                  </span>
                  <Button
                    className="winner-again"
                    variant="secondary"
                    onClick={start}
                  >
                    <RotateCcw size={16} /> Ещё один заезд
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="race-footer">
            <span>
              <Waves size={17} /> Гейзеры → пинбол → турбо → вихрь → финиш
            </span>
            <span>Около 30 секунд, как поплывёт</span>
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
