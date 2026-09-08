export type Member = { id: number; name: string; active: boolean };
export const STORAGE_KEY = 'quack-prix-roster-v1';
export function emptyRoster(): Member[] {
  return Array.from({ length: 8 }, (_, id) => ({ id, name: '', active: true }));
}
export function parseRoster(raw: string | null): Member[] {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (
      !Array.isArray(value) ||
      value.length !== 8 ||
      value.some(
        (p) =>
          !p || typeof p.name !== 'string' || typeof p.active !== 'boolean',
      )
    )
      return emptyRoster();
    return value.map((p, id) => ({
      id,
      name: p.name.slice(0, 24),
      active: p.active,
    }));
  } catch {
    return emptyRoster();
  }
}
export function raceMembers(roster: Member[]): Member[] {
  if (!Array.isArray(roster) || roster.length > 8)
    throw new Error('В заезде может быть до восьми участников.');
  const members = roster
    .filter((p) => p.active && p.name.trim())
    .map((p) => ({ ...p, name: p.name.trim() }));
  if (!members.length)
    throw new Error('Впиши хотя бы одно имя и отметь участника.');
  if (members.some((p) => p.name.length > 24))
    throw new Error('Имя должно быть не длиннее 24 символов.');
  const names = members.map((p) =>
    p.name.normalize('NFKC').toLocaleLowerCase('ru'),
  );
  if (new Set(names).size !== names.length)
    throw new Error('Имена повторяются — добавь фамилию или ник.');
  return members;
}
