import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyProject } from '../data/example';
import { useProjectPersistence } from './useProjectPersistence';
const key = 'fusionpcr-storage-regression';

describe('unreadable saved project recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it.each(['{broken JSON', 'null', '{"unexpected":"shape"}'])(
    'preserves unreadable saved bytes on startup: %s',
    async (raw) => {
      localStorage.setItem(key, raw);
      const { result } = renderHook(() =>
        useProjectPersistence(key, emptyProject),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(localStorage.getItem(key)).toBe(raw);
      expect(result.current.persistenceState).toBe('failed');
    },
  );
  it('preserves original bytes in a verified recovery copy before saving later edits', async () => {
    const raw = '{broken JSON';
    localStorage.setItem(key, raw);
    const { rerender } = renderHook(
      ({ project }) => useProjectPersistence(key, project),
      { initialProps: { project: emptyProject } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    const edited = { ...emptyProject, notes: 'New notes' };
    rerender({ project: edited });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(edited);
    const recoveryKeys = Object.keys(localStorage).filter((storedKey) =>
      storedKey.startsWith(key + '-recovery-'),
    );
    expect(recoveryKeys).toHaveLength(1);
    expect(localStorage.getItem(recoveryKeys[0])).toBe(raw);
  });
  it.each(['throw', 'silent'])(
    'does not overwrite the source when recovery storage fails: %s',
    async (failure) => {
      const raw = '{broken JSON';
      localStorage.setItem(key, raw);
      const realSet = Storage.prototype.setItem;
      const set = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(function (this: Storage, storedKey, value) {
          if (storedKey.startsWith(key + '-recovery-')) {
            if (failure === 'throw')
              throw new DOMException('Quota exceeded', 'QuotaExceededError');
            return;
          }
          realSet.call(this, storedKey, value);
        });
      const { result, rerender } = renderHook(
        ({ project }) => useProjectPersistence(key, project),
        { initialProps: { project: emptyProject } },
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      const edited = { ...emptyProject, notes: 'Unsaved but exportable notes' };
      rerender({ project: edited });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(localStorage.getItem(key)).toBe(raw);
      expect(result.current.persistenceState).toBe('failed');
      expect(result.current.recoverySnapshot).toBe(raw);
      set.mockRestore();
      act(() => result.current.retryPersistence());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual(edited);
      expect(result.current.persistenceState).toBe('saved');
    },
  );

  it('leaves a valid saved project on the normal autosave path', async () => {
    localStorage.setItem(key, JSON.stringify(emptyProject));
    const { result } = renderHook(() =>
      useProjectPersistence(key, emptyProject),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.persistenceState).toBe('saved');
    expect(result.current.recoverySnapshot).toBeNull();
    expect(Object.keys(localStorage)).toEqual([key]);
  });
});
