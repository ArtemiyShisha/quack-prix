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
import { MarbleTrack } from '@/components/marble-track';
import { PinballTable } from '@/components/pinball-table';
import { DEFAULT_PINBALL_MAP, mapInfo } from '@/lib/pinball-maps';
import { DESCENT_RELEASE_AT, DESCENT_MAX_SECONDS } from '@/lib/pinball-descent';
import { MARBLE_MAX_SECONDS } from '@/lib/marble-track';
import { RaceTrack } from '@/components/race-track';
import { useRace, type GameMode } from '@/hooks/use-race';
import {
  emptyRoster,
  parseRoster,
  STORAGE_KEY,
  type Member,
} from '@/lib/roster';
import { HUES, FINISH_DISTANCE } from '@/lib/track';
import { FLUSH_SECONDS, MAX_SECONDS } from '@/lib/race';
import { prepareSound, quack } from '@/lib/sound';
import { useGameTools } from '@/hooks/use-game-tools';
import { appUrl } from '@/lib/urls';

export function DuckGame({ mode = 'classic' }: { mode?: GameMode }) {
  const is3d = mode === 'marbles';
  const isPinball = mode === 'pinball';
  const needsScene = is3d || isPinball;
  const [sceneReady, setSceneReady] = useState(false);
  const [roster, setRoster] = useState<Member[]>(emptyRoster);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [error, setError] = useState('');
  const [sound, setSound] = useState(false);
  const selectedMap = mapInfo(DEFAULT_PINBALL_MAP);
  const [overview, setOverview] = useState(is3d);
  const race = useRace(mode, !needsScene || sceneReady);
  const { setup, frame, countdown, running, paused } = race;
  const result = frame?.result;
  const winner = result && setup ? setup.members[result.slot] : null;
  const announced = useRef<number | null>(null);
  const count = roster.filter((p) => p.name.trim() && p.active).length;
  const progress = isPinball
    ? result
      ? 100
      : 0
    : frame
      ? Math.min(
          100,
          Math.max(
            0,
            (Math.max(...frame.ducks.map((d) => d.progress)) /
              FINISH_DISTANCE) *
              100,
          ),
        )
      : 0;
  const leader =
    frame && setup
      ? [...frame.ducks].sort((a, b) => b.progress - a.progress)[0]
      : null;
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
      if (needsScene && !sceneReady)
        throw new Error('Подожди, пока загрузится 3D-сцена.');
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
    ? needsScene && !sceneReady
      ? 'Загрузка 3D — гонка на паузе'
      : 'Пауза — вкладка неактивна'
    : winner
      ? isPinball
        ? 'Раунд завершён! Ведущий найден'
        : 'Финиш! Ведущий найден'
      : countdown
        ? `На старт… ${countdown}`
        : isPinball && running
          ? 'Мультибол! Все участники в игре'
          : frame?.flushing
            ? 'Большой смыв! Утки спешат к выходу'
            : running
              ? `${leaderMember?.name ?? 'Утка'} впереди — гонка продолжается`
              : isPinball
                ? 'Кряк-машина готова — запускай шарики'
                : 'Утки на старте';
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
        <div className="header-caption">
          {isPinball
            ? 'Один раунд. Один ведущий.'
            : 'Один заезд. Один ведущий.'}
        </div>
        <span className="edition">
          <span /> DAILY EDITION
        </span>
      </header>
      <nav className="mode-switch" aria-label="Режим игры">
        <a
          href={appUrl('/')}
          aria-current={!is3d && !isPinball ? 'page' : undefined}
        >
          🦆 Аквапарк
        </a>
        <a href={appUrl('/3d/')} aria-current={is3d ? 'page' : undefined}>
          🔮 Шарики 3D
        </a>
        <a
          href={appUrl('/pinball/')}
          aria-current={isPinball ? 'page' : undefined}
        >
          ⚡ Пинбол 3D <span>НОВОЕ</span>
        </a>
      </nav>
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
            disabled={
              count === 0 || running || !loaded || (needsScene && !sceneReady)
            }
            onClick={start}
          >
            {result ? <RotateCcw size={19} /> : <Flag size={19} />}{' '}
            {running
              ? isPinball
                ? 'Шарики в игре…'
                : 'Утки в пути…'
              : result
                ? isPinball
                  ? 'Ещё один раунд'
                  : 'Ещё один заезд'
                : isPinball
                  ? 'Запустить мультибол'
                  : 'Выпустить уток'}{' '}
            <ArrowUpRight size={19} />
          </Button>
          <details className="fairness-details">
            <summary>
              <Info size={16} /> Как работает случайность
            </summary>
            {isPinball ? (
              <>
                <p>
                  Все шарики начинают из покоя на одной высоте. Общая заслонка
                  одновременно выпускает их на разгонную площадку трёхэтажной
                  карты «Глубина». Грибки, роторы и возвратные пружины меняют их
                  движение при контакте. Первые две лунки ведут на следующий
                  этаж. Ведущего выбирает первое попадание в третью лунку — в
                  ядре.
                </p>
                <p>
                  Имена независимо перемешиваются по одинаковым шарикам. Фазы
                  механизмов каждый раз новые, стартовые условия одинаковы для
                  всех; физика не получает имён и мест. При одновременном финише
                  сравниваем моменты пересечения. После {DESCENT_RELEASE_AT}{' '}
                  секунд пружины отключаются, механизмы останавливаются и
                  поднимаются, а на {DESCENT_MAX_SECONDS}-й секунде остаётся
                  явно обозначенный резервный выбор по пройденному этажу и
                  расстоянию до финиша.
                </p>
              </>
            ) : is3d ? (
              <>
                <p>
                  Имена независимо распределяются по одинаковым шарикам перед
                  каждым заездом. Уклон, вращение и столкновения определяют
                  траекторию. Начальные положения и фаза препятствия каждый раз
                  новые. Кто первым прокатится через финиш, тот и ведущий.
                </p>
                <p>
                  Точного срока у гонки нет. Если заезд затянется до{' '}
                  {MARBLE_MAX_SECONDS} секунд, сработает резервный выбор по
                  продвижению. Повторные победы возможны.
                </p>
              </>
            ) : (
              <>
                <p>
                  Перед каждым заездом имена случайно распределяются по
                  стартовым местам. На трассе — вираж, два рукава вокруг
                  острова, каскад с качелями и финальная чаша. Скорость входа и
                  столкновения меняют орбиту: можно пройти по внутренней
                  траектории или сделать ещё круг. Остров, уступы и маятники
                  влияют только при контакте. Стартовые положения и фазы
                  маятников каждый раз новые. Все утки одинаковы по весу и
                  размеру — кто первым пересечёт финиш, тот и ведущий.
                </p>
                <p>
                  Точного срока у гонки нет. На {FLUSH_SECONDS}-й секунде
                  включается «Большой смыв». Если к {MAX_SECONDS}-й секунде
                  никто не финишировал, ведущим станет тот, кто продвинулся
                  дальше. Повторные победы возможны.
                </p>
              </>
            )}
          </details>
          {running && (
            <p className="race-hint">
              {isPinball
                ? 'Первые две лунки ведут на следующий этаж.'
                : 'Можно болеть за свою.'}
              <br />
              {isPinball
                ? 'Победа — падение в лунку ядра.'
                : 'Подталкивать экран бесполезно.'}
            </p>
          )}
        </aside>
        <section
          className="race-panel"
          aria-label={isPinball ? 'Поле пинбола в 3D' : 'Гоночная трасса'}
        >
          <div className="race-heading">
            <div>
              <div className="eyebrow">
                {isPinball
                  ? 'ИГРА 03 · МУЛЬТИБОЛ'
                  : is3d
                    ? 'ТРАССА 02 · НАСТОЛЬНЫЙ ХАОС'
                    : 'ТРАССА 01 · УТИНЫЙ АКВАПАРК'}
              </div>
              <h2>
                {isPinball
                  ? 'Кряк-машина'
                  : is3d
                    ? 'Кряк на виражах'
                    : 'Большой заплыв'}
                <span className="track-sticker">
                  {needsScene ? '3D' : 'КРЯ!'}
                </span>
              </h2>
            </div>
            <div className="view-controls">
              {!isPinball && (
                <Button
                  variant="ghost"
                  className="overview-button"
                  onClick={() => setOverview((v) => !v)}
                  aria-pressed={overview}
                >
                  {overview ? <Navigation size={17} /> : <Scan size={17} />}
                  <span>
                    {overview
                      ? is3d
                        ? 'За шариками'
                        : 'За утками'
                      : 'Вся трасса'}
                  </span>
                </Button>
              )}
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
          {isPinball && (
            <p className="pinball-map-description">
              <strong>{selectedMap.name}.</strong> {selectedMap.description}
            </p>
          )}
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
            {isPinball ? (
              <PinballTable
                members={setup?.members ?? roster}
                frame={frame}
                onReady={setSceneReady}
                sound={sound}
              />
            ) : is3d ? (
              <MarbleTrack
                members={setup?.members ?? roster}
                frame={frame}
                overview={overview}
                onReady={setSceneReady}
              />
            ) : (
              <RaceTrack
                members={setup?.members ?? roster}
                frame={frame}
                overview={overview}
              />
            )}
            {countdown && (
              <div className="countdown" aria-hidden="true">
                <span>{countdown}</span>
                <p>
                  {isPinball
                    ? 'Сейчас будет мультибол'
                    : 'Приготовились покрякать'}
                </p>
              </div>
            )}
            {winner && result && (
              <div
                className={
                  isPinball
                    ? 'pinball-result'
                    : is3d
                      ? 'marble-result'
                      : 'winner-overlay'
                }
              >
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
                    {isPinball && result.reason === 'distance'
                      ? 'Лимит времени — по этажу и близости к лунке'
                      : result.reason === 'finish'
                        ? `Финиш за ${result.time.toFixed(1)} сек.`
                        : 'Лимит времени — победа по дистанции'}
                  </span>
                  <Button
                    className="winner-again"
                    variant="secondary"
                    onClick={start}
                  >
                    <RotateCcw size={16} />{' '}
                    {isPinball ? 'Ещё один раунд' : 'Ещё один заезд'}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="race-footer">
            <span>
              <Waves size={17} />{' '}
              {isPinball
                ? selectedMap.tagline
                : is3d
                  ? 'Повороты и препятствия — каждый раз по-новому.'
                  : 'Виражи, развилки, качели. Один финиш.'}
            </span>
            <span>
              {isPinball
                ? 'Все в игре до первого финиша'
                : is3d
                  ? 'Как покатится — так покатится'
                  : 'Около 30 секунд, как поплывёт'}
            </span>
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
