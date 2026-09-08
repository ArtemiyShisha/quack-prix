import test from 'node:test';
import assert from 'node:assert/strict';
import {
  randomBelow,
  shuffled,
  seededRandom,
  freshSeed,
} from '../lib/random.ts';

test('bounded random rejects the modulo tail and draws again', () => {
  const samples = [0xffffffff, 5];
  let calls = 0;
  assert.equal(
    randomBelow(3, () => samples[calls++]),
    2,
  );
  assert.equal(calls, 2);
  assert.throws(() => randomBelow(0), /bound/);
});
test('shuffle preserves each participant exactly once for 1–8 people', () => {
  for (let n = 1; n <= 8; n++) {
    const source = seededRandom(713 + n);
    const original = Array.from({ length: n }, (_, i) => i);
    const result = shuffled(original, () => Math.floor(source() * 2 ** 32));
    assert.deepEqual([...result].sort(), original);
    assert.deepEqual(
      original,
      Array.from({ length: n }, (_, i) => i),
    );
  }
});
test('every possible shuffle of three identities assigns each slot equally', () => {
  const counts = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const values = [i, j];
      let k = 0;
      shuffled([0, 1, 2], () => values[k++]).forEach(
        (identity, slot) => counts[slot][identity]++,
      );
    }
  assert.deepEqual(counts, [
    [2, 2, 2],
    [2, 2, 2],
    [2, 2, 2],
  ]);
});
test('seeded physics is reproducible and new cryptographic seeds vary', () => {
  const a = seededRandom(123),
    b = seededRandom(123),
    c = seededRandom(124);
  const sa = Array.from({ length: 10 }, a);
  assert.deepEqual(sa, Array.from({ length: 10 }, b));
  assert.notDeepEqual(sa, Array.from({ length: 10 }, c));
  assert.ok(sa.every((n) => n >= 0 && n < 1));
  assert.ok(new Set(Array.from({ length: 20 }, freshSeed)).size > 1);
});
