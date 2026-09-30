'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RaceSimulation,
  STEP_MS,
  COUNTDOWN_SECONDS,
  type Frame,
} from '@/lib/race';
import { MarbleSimulation } from '@/lib/marble-race';
import { freshSeed, shuffled } from '@/lib/random';
import { MARBLE_PREVIEW_SEED, nextMarbleSeed } from '@/lib/marble-path';
import { raceMembers, type Member } from '@/lib/roster';
export type RaceSetup = { members: Member[]; seed: number; sequence: number };
export function useRace(
  mode: 'classic' | 'marbles' = 'classic',
  enabled = true,
) {
  const [setup, setSetup] = useState<RaceSetup | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const locked = useRef(false);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
    setPaused(document.hidden || !enabled);
  }, [enabled]);
  const sequence = useRef(0);
  const previousMarbleSeed = useRef(MARBLE_PREVIEW_SEED);
  const start = useCallback(
    (roster: Member[]) => {
      if (locked.current) throw new Error('Заезд уже идёт.');
      const members = raceMembers(roster);
      // Separate cryptographic draws: physical conditions are never derived from identity order.
      const ordered = shuffled(members);
      const seed =
        mode === 'marbles'
          ? nextMarbleSeed(previousMarbleSeed.current)
          : freshSeed();
      if (mode === 'marbles') previousMarbleSeed.current = seed;
      const next = { members: ordered, seed, sequence: ++sequence.current };
      locked.current = true;
      setFrame(null);
      setCountdown(COUNTDOWN_SECONDS);
      setSetup(next);
      return { participants: ordered.map((p) => p.name), status: 'countdown' };
    },
    [mode],
  );
  const reset = useCallback(() => {
    if (locked.current) return;
    setSetup(null);
    setFrame(null);
    setCountdown(null);
  }, []);
  useEffect(() => {
    if (!setup) return;
    const simulation =
      mode === 'marbles'
        ? new MarbleSimulation(setup.members.length, setup.seed)
        : new RaceSimulation(setup.members.length, setup.seed);
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
    return () => {
      finished = true;
      cancelAnimationFrame(request);
      document.removeEventListener('visibilitychange', visibility);
      simulation.destroy();
    };
  }, [setup, mode]);
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
