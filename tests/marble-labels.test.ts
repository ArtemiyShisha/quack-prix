import test from 'node:test';
import assert from 'node:assert/strict';
import { placeMarbleLabels } from '../lib/marble-label-layout.ts';
void test('eight long names fit around a dense pack in overview and mobile views', () => {
  for (const [width, height] of [
    [760, 650],
    [320, 490],
  ]) {
    for (const anchorY of [12, 160, height - 12]) {
      const boxes = placeMarbleLabels(
        Array.from({ length: 8 }, (_, slot) => ({
          slot,
          x: width / 2 + (slot % 4) * 2,
          y: anchorY + Math.floor(slot / 4) * 2,
          width: 190,
          height: 35,
        })),
        width,
        height,
      );
      assert.equal(boxes.length, 8);
      for (const a of boxes) {
        assert.ok(
          a.x >= 0 &&
            a.y >= 0 &&
            a.x + a.width <= width &&
            a.y + a.height <= height,
        );
        for (const b of boxes) {
          if (a.slot !== b.slot)
            assert.ok(
              a.x + a.width <= b.x ||
                b.x + b.width <= a.x ||
                a.y + a.height <= b.y ||
                b.y + b.height <= a.y,
            );
        }
      }
    }
  }
});
void test('an overcrowded viewport never forces two names into the same box', () => {
  const boxes = placeMarbleLabels(
    Array.from({ length: 8 }, (_, slot) => ({
      slot,
      x: 100,
      y: 20,
      width: 180,
      height: 40,
    })),
    200,
    70,
  );
  assert.equal(boxes.length, 1);
});
