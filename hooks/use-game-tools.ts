'use client';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { emptyRoster, raceMembers, type Member } from '@/lib/roster';
type State = {
  roster: Member[];
  running: boolean;
  loaded: boolean;
  status: string;
  winner: string | null;
  setRoster: (next: Member[]) => void;
  start: () => { participants: string[]; status: string } | null;
};
type ModelTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type ToolDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: ModelTool,
      options: { signal: AbortSignal },
    ) => void | Promise<void>;
  };
};
export function useGameTools(state: State) {
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const context = (document as ToolDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: ModelTool[] = [
      {
        name: 'set_daily_team',
        title: 'Записать команду',
        description:
          'Replace the local team roster with 1–8 names before a race. Changes the visible form and saves on this browser.',
        inputSchema: {
          type: 'object',
          properties: {
            names: {
              type: 'array',
              items: { type: 'string', minLength: 1, maxLength: 24 },
              minItems: 1,
              maxItems: 8,
            },
          },
          required: ['names'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute(input) {
          if (!latest.current.loaded || latest.current.running)
            throw new Error(
              'Wait until the current race finishes and the roster is ready.',
            );
          const names = (input as { names?: unknown } | null)?.names;
          if (
            !Array.isArray(names) ||
            names.length < 1 ||
            names.length > 8 ||
            names.some(
              (n) => typeof n !== 'string' || !n.trim() || n.length > 24,
            )
          )
            throw new Error(
              'Provide 1–8 nonempty names, up to 24 characters each.',
            );
          const next = emptyRoster();
          names.forEach((name, i) => {
            next[i].name = name.trim();
          });
          raceMembers(next);
          flushSync(() => latest.current.setRoster(next));
          return {
            names: latest.current.roster
              .filter((p) => p.name)
              .map((p) => p.name),
            status: 'configured',
          };
        },
      },
      {
        name: 'start_duck_race',
        title: 'Выпустить уток',
        description:
          'Start a fresh physical duck race with the active people in the current visible roster. The winner will be announced when the race finishes.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute() {
          if (!latest.current.loaded || latest.current.running)
            throw new Error(
              'The team is not ready or a race is already running.',
            );
          raceMembers(latest.current.roster);
          let started: ReturnType<State['start']> = null;
          flushSync(() => {
            started = latest.current.start();
          });
          if (!started)
            throw new Error(
              'The race could not start. Check the visible team form.',
            );
          return started;
        },
      },
      {
        name: 'read_duck_race',
        title: 'Узнать результат',
        description:
          'Read the current duck race status, active names and winner without changing anything.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute() {
          return {
            status: latest.current.status,
            participants: latest.current.roster
              .filter((p) => p.name.trim() && p.active)
              .map((p) => p.name.trim()),
            winner: latest.current.winner,
          };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser capability. */
      }
    }
    return () => lifecycle.abort();
  }, []);
}
