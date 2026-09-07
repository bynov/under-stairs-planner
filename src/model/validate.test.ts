import { describe, it, expect } from 'vitest';
import { validate } from './validate';
import { defaultProject } from './defaults';
import { tm } from '../i18n';

const paths = (p: ReturnType<typeof defaultProject>) => validate(p).map((e) => e.path);

describe('validate', () => {
  it('accepts the default project', () => {
    expect(validate(defaultProject())).toEqual([]);
  });
  it('rejects heightMin >= heightMax', () => {
    const p = defaultProject();
    p.envelope.heightMin = 2200;
    expect(paths(p)).toContain('envelope.heightMin');
  });
  it('rejects cabinet deeper than envelope allows', () => {
    const p = defaultProject();
    p.cabinet.depth = 900;
    expect(paths(p)).toContain('cabinet.depth');
  });
  it('rejects columns wider than the envelope', () => {
    const p = defaultProject();
    p.cabinet.columns[0].width = 3000;
    expect(paths(p)).toContain('cabinet.columns');
  });
  it('rejects a column that is too narrow', () => {
    const p = defaultProject();
    p.cabinet.columns[1].width = 100;
    expect(paths(p)).toContain('cabinet.columns[1].width');
  });
  it('rejects a column whose low side is below the minimum height', () => {
    const p = defaultProject();
    p.envelope.heightMin = 0; // last column x1 = 2500 -> ceilY = 84.6
    expect(paths(p)).toContain('cabinet.columns[3].width');
  });
  it('requires at least one drawer for drawer fronts', () => {
    const p = defaultProject();
    p.cabinet.columns[2].drawerCount = 0;
    expect(paths(p)).toContain('cabinet.columns[2].drawerCount');
  });
  it('does not produce NaN-driven errors when the envelope is invalid', () => {
    const p = defaultProject();
    p.envelope.length = 0;
    const errs = validate(p);
    expect(errs.map((e) => e.path)).toContain('envelope.length');
    expect(errs.every((e) => !tm('en', e.message).includes('NaN'))).toBe(true);
  });
  it('messages are i18n Msg objects with params', () => {
    const p = defaultProject();
    p.cabinet.columns[1].width = 100;
    const e = validate(p).find((x) => x.path === 'cabinet.columns[1].width')!;
    expect(e.message).toEqual({ key: 'error.columnWidth', params: { n: 2, min: 136 } });
  });
});
