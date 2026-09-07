import { describe, it, expect } from 'vitest';
import { drawingToSvg } from './svg';
import { frontView } from '../drawing/views';
import { makeDrawing, text, line, poly } from '../drawing/ir';
import { defaultProject } from '../model/defaults';
import { v2 } from '../geometry/vec';

describe('drawingToSvg', () => {
  it('renders the front view with a viewBox and dimension labels', () => {
    const svg = drawingToSvg(frontView(defaultProject()));
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="')).toBe(true);
    expect(svg).toContain('<title>Front elevation</title>');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<line');
    expect(svg).toContain('>2500<');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).not.toContain('NaN');
    expect(svg.endsWith('</svg>')).toBe(true);
  });
  it('flips Y, rotates text the other way, escapes text', () => {
    const d = makeDrawing('t', [
      line(v2(0, 0), v2(10, 20)),
      text(v2(5, 5), 'a<b', 4, 'middle', 90),
      poly([v2(0, 0), v2(1, 0), v2(1, 1)], 'thick', 'panel'),
    ], 4);
    const svg = drawingToSvg(d);
    expect(svg).toContain('y2="-20"');
    expect(svg).toContain('rotate(-90)');
    expect(svg).toContain('a&lt;b');
    expect(svg).toContain('fill="#e8e2d5"');
    expect(svg).toContain('stroke-width="2"');
  });
});
