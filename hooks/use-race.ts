'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { STEP_MS, COUNTDOWN_SECONDS } from '@/lib/race';
import { initPinballPhysics } from '@/lib/pinball';
import { PinballArenaSimulation, type ArenaFrame } from '@/lib/pinball-arenas';
import { freshSeed, shuffled } from '@/lib/random';
import { raceMembers, type Member } from '@/lib/roster';
export type RaceSetup = { members: Member[]; seed: number; sequence: number };
export function useRace(enabled = true) {
  const [setup, setSetup] = useState<RaceSetup | null>(null);
  const [frame, setFrame] = useState<ArenaFrame | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const locked = useRef(false);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
    setPaused(document.hidden || !enabled);
  }, [enabled]);
  const sequence = useRef(0);
  const start = useCallback((roster: Member[]) => {
    if (locked.current) throw new Error('Раунд уже идёт.');
    const members = raceMembers(roster);
    // Separate cryptographic draws: physical conditions are never derived from identity order.
    const ordered = shuffled(members);
    const seed = freshSeed();
    const next = { members: ordered, seed, sequence: ++sequence.current };
    locked.current = true;
    setFrame(null);
    setCountdown(COUNTDOWN_SECONDS);
    setSetup(next);
    return { participants: ordered.map((p) => p.name), status: 'countdown' };
  }, []);
  const reset = useCallback(() => {
    if (locked.current) return;
    setSetup(null);
    setFrame(null);
    setCountdown(null);
  }, []);
  useEffect(() => {
    if (!setup) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const run = () => {
      if (disposed) return;
      const simulation = new PinballArenaSimulation(
        setup.members.length,
        setup.seed,
      );
      setFrame(simulation.snapshot());
      let previous = performance.now(),
        accumulator = 0,
        countdownMs = 0,
        lastRender = 0,
        request = 0,
        finished = false;
      const visibility = () => {
        previous = performance.now();
        setPaused(document.hidden || !enabledRef.current);
      };
      document.addEventListener('visibilitychange', visibility);
      const animate = (now: number) => {
        if (finished) return;
        const delta = Math.min(now - previous, 120);
        previous = now;
        if (document.hidden || !enabledRef.current) {
          request = requestAnimationFrame(animate);
          return;
        }
        if (countdownMs < COUNTDOWN_SECONDS * 1000) {
          countdownMs += delta;
          setCountdown(
            Math.max(
              1,
              Math.ceil((COUNTDOWN_SECONDS * 1000 - countdownMs) / 1000),
            ),
          );
        } else {
          setCountdown(null);
          accumulator += delta;
          let current = simulation.snapshot();
          while (accumulator >= STEP_MS && !current.result) {
            current = simulation.step();
            accumulator -= STEP_MS;
          }
          if (now - lastRender >= 30 || current.result) {
            setFrame(current);
            lastRender = now;
          }
          if (current.result) {
            locked.current = false;
            finished = true;
            setPaused(false);
            return;
          }
        }
        request = requestAnimationFrame(animate);
      };
      request = requestAnimationFrame(animate);
      cleanup = () => {
        finished = true;
        cancelAnimationFrame(request);
        document.removeEventListener('visibilitychange', visibility);
        simulation.destroy();
      };
    };
    // Restored setup or HMR can mount before the scene's readiness callback.
    void initPinballPhysics()
      .then(run)
      .catch(() => {
        if (disposed) return;
        locked.current = false;
        setSetup(null);
        setCountdown(null);
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [setup]);
  return {
    setup,
    frame,
    countdown,
    paused,
    start,
    reset,
    running: setup !== null && !frame?.result,
  };
}
