import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRoster, parseRoster, raceMembers } from '../lib/roster.ts';
test('empty or corrupted storage gives eight blank editable rows', () => {
  for (const raw of [null, '{', 'false', '[{"name":42}]']) {
    const roster = parseRoster(raw);
    assert.equal(roster.length, 8);
    assert.ok(roster.every((p) => p.name === '' && p.active));
  }
});
test('saved roster restores names and attendance, without trusting stored ids', () => {
  const roster = emptyRoster();
  roster[1].name = 'Лена';
  roster[1].active = false;
  assert.deepEqual(parseRoster(JSON.stringify(roster)), roster);
});
test('race includes only named active people and trims names', () => {
  const roster = emptyRoster();
  roster[0].name = ' Саша ';
  roster[2].name = 'Лена';
  roster[2].active = false;
  assert.deepEqual(raceMembers(roster), [
    { id: 0, name: 'Саша', active: true },
  ]);
});
test('reject empty, duplicate names, too many people, and overlong names', () => {
  assert.throws(() => raceMembers(emptyRoster()), /имя/);
  assert.throws(
    () =>
      raceMembers([
        { id: 0, name: 'Лена', active: true },
        { id: 1, name: ' лена ', active: true },
      ]),
    /повтор/,
  );
  assert.throws(
    () =>
      raceMembers(
        Array.from({ length: 9 }, (_, i) => ({
          id: i,
          name: String(i),
          active: true,
        })),
      ),
    /восьми/,
  );
  assert.throws(
    () => raceMembers([{ id: 0, name: 'я'.repeat(25), active: true }]),
    /24/,
  );
});
