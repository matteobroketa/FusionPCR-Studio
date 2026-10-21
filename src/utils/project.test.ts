import { afterEach, describe, expect, it, vi } from 'vitest';
import { exampleProject } from '../data/example';
import { loadInitialProject, normalizeImportedProject } from './project';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('project imports', () => {
  it.each(['q5', 'phusion_plus'])(
    'accepts the supported %s polymerase',
    (polymeraseId) => {
      expect(
        normalizeImportedProject({ ...exampleProject, polymeraseId })
          ?.polymeraseId,
      ).toBe(polymeraseId);
    },
  );

  it.each(['unknown', '__proto__', 'constructor', ''])(
    'rejects an unsupported polymerase %s',
    (polymeraseId) => {
      expect(
        normalizeImportedProject({ ...exampleProject, polymeraseId }),
      ).toBeNull();
    },
  );

  it.each([
    'exact',
    'protein-fusion',
    'insertion',
    'deletion',
    'substitution',
    'domain-swap',
  ])('preserves supported design mode %s', (mode) => {
    expect(normalizeImportedProject({ ...exampleProject, mode })?.mode).toBe(
      mode,
    );
  });

  it('defaults missing legacy mode to exact and rejects an unknown mode', () => {
    expect(
      normalizeImportedProject({ ...exampleProject, mode: undefined })?.mode,
    ).toBe('exact');
    expect(
      normalizeImportedProject({ ...exampleProject, mode: 'unknown-mode' }),
    ).toBeNull();
    expect(
      normalizeImportedProject({ ...exampleProject, mode: null }),
    ).toBeNull();
  });

  it.each([NaN, Infinity, -Infinity])(
    'rejects non-finite fragment coordinates (%s)',
    (coordinate) => {
      for (const fragmentKey of ['fragmentA', 'fragmentB'] as const) {
        for (const coordinateKey of ['start', 'end'] as const) {
          expect(
            normalizeImportedProject({
              ...exampleProject,
              [fragmentKey]: {
                ...exampleProject[fragmentKey],
                [coordinateKey]: coordinate,
              },
            }),
          ).toBeNull();
        }
      }
    },
  );
});

describe('startup recovery', () => {
  it('uses the fallback when browser storage access is denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError');
    });
    expect(loadInitialProject('test-project', exampleProject)).toBe(
      exampleProject,
    );
  });

  it('uses the fallback when the localStorage getter itself is denied', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError');
    });
    expect(loadInitialProject('test-project', exampleProject)).toBe(
      exampleProject,
    );
  });

  it('uses the fallback for corrupt or unsupported saved data', () => {
    window.localStorage.setItem('test-project', '{broken json');
    expect(loadInitialProject('test-project', exampleProject)).toBe(
      exampleProject,
    );
    window.localStorage.setItem(
      'test-project',
      JSON.stringify({ ...exampleProject, polymeraseId: 'unsupported' }),
    );
    expect(loadInitialProject('test-project', exampleProject)).toBe(
      exampleProject,
    );
  });

  it('restores a supported saved project with recalculated metadata', () => {
    window.localStorage.setItem(
      'test-project',
      JSON.stringify({
        ...exampleProject,
        name: 'Saved design',
        projectHash: 'stale',
      }),
    );
    const restored = loadInitialProject('test-project', exampleProject);
    expect(restored.name).toBe('Saved design');
    expect(restored.projectHash).toMatch(/^proj-[0-9a-f]{8}$/);
    expect(restored.modifiedAt).toBe(exampleProject.modifiedAt);
  });
});
