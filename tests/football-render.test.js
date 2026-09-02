// The perspective projection behind the football renderer (#72): pure maths.
import { describe, it, expect } from 'vitest';
import { projectFootball3D } from '../src/sports/football/render.js';

describe('projectFootball3D', () => {
  it('maps the far touchline narrower and higher than the near one', () => {
    const farL = projectFootball3D(48, 34), farR = projectFootball3D(912, 34);
    const nearL = projectFootball3D(48, 506), nearR = projectFootball3D(912, 506);
    expect(farR.x - farL.x).toBeLessThan(nearR.x - nearL.x);
    expect(farL.y).toBeLessThan(nearL.y);
    expect(farL.scale).toBeLessThan(nearL.scale);
  });
  it('keeps the whole pitch inside the canvas', () => {
    for (const [x, y] of [[48, 34], [912, 34], [912, 506], [48, 506], [480, 270]]) {
      const p = projectFootball3D(x, y);
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(960);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(540);
    }
  });
  it('lifts a point with height straight up on screen', () => {
    const ground = projectFootball3D(480, 300), lifted = projectFootball3D(480, 300, 30);
    expect(lifted.x).toBeCloseTo(ground.x, 6);
    expect(lifted.y).toBeLessThan(ground.y);
  });
  it('preserves left-right order and the centre line', () => {
    expect(projectFootball3D(480, 100).x).toBeCloseTo(480, 6);
    expect(projectFootball3D(200, 400).x).toBeLessThan(projectFootball3D(700, 400).x);
  });
});
