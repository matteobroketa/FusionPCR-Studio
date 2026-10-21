import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ChangeEvent } from 'react';
import { emptyProject, exampleProjects } from '../data/example';
import { useProjectController } from './useProjectController';

function deferredFile() {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const text = new Promise<string>((resolveText, rejectText) => {
    resolve = resolveText;
    reject = rejectText;
  });
  const event = {
    target: { files: [{ text: () => text }], value: 'selected' },
  } as unknown as ChangeEvent<HTMLInputElement>;
  return { event, resolve, reject };
}

describe('project file read ordering', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it('requests confirmation for edits made while an initially empty project is reading', async () => {
    const { result } = renderHook(useProjectController);
    const file = deferredFile();
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleImportFile(file.event);
    });
    act(() => result.current.updateFragmentSequence('fragmentA', 'ACGTACGT'));
    await act(async () => {
      file.resolve(JSON.stringify(exampleProjects['exact-fusion']));
      await pending;
    });
    expect(result.current.project.fragmentA.sequence).toBe('ACGTACGT');
    expect(result.current.confirmationState?.confirmLabel).toBe(
      'Import project',
    );
  });

  it('preserves the latest edited project as the recovery snapshot on import confirmation', async () => {
    window.localStorage.setItem(
      'fusionpcr-studio-project',
      JSON.stringify(exampleProjects['exact-fusion']),
    );
    const { result } = renderHook(useProjectController);
    const file = deferredFile();
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleImportFile(file.event);
    });
    act(() =>
      result.current.updateProject('notes', 'Notes added during the read'),
    );
    await act(async () => {
      file.resolve(JSON.stringify(exampleProjects['protein-fusion']));
      await pending;
    });
    act(() => result.current.confirmationState!.onConfirm());
    expect(result.current.project.name).toBe(
      exampleProjects['protein-fusion'].name,
    );
    expect(result.current.recoverableProjectSnapshot?.notes).toBe(
      'Notes added during the read',
    );
  });

  it('ignores an older project file that finishes after a newer selection', async () => {
    const { result } = renderHook(useProjectController);
    const older = deferredFile();
    const newer = deferredFile();
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = result.current.handleImportFile(older.event);
      second = result.current.handleImportFile(newer.event);
    });
    await act(async () => {
      newer.resolve(JSON.stringify(exampleProjects['protein-fusion']));
      await second;
    });
    await act(async () => {
      older.resolve(JSON.stringify(exampleProjects['exact-fusion']));
      await first;
    });
    expect(result.current.project.name).toBe(
      exampleProjects['protein-fusion'].name,
    );
    expect(result.current.confirmationState).toBeNull();
  });

  it('does not replace a loaded example when an earlier project read completes', async () => {
    const { result } = renderHook(useProjectController);
    const file = deferredFile();
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleImportFile(file.event);
    });
    act(() => result.current.loadExample('protein-fusion'));
    await act(async () => {
      file.resolve(JSON.stringify(emptyProject));
      await pending;
    });
    expect(result.current.project.name).toBe(
      exampleProjects['protein-fusion'].name,
    );
  });

  it('keeps manually edited sequence import text when a pending file completes', async () => {
    const { result } = renderHook(useProjectController);
    const file = deferredFile();
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleSequenceFileImport(file.event);
    });
    act(() => {
      result.current.setSequenceImportText('>Manual sequence\nTTTTAAAA');
      result.current.parseSequenceImportText('>Manual sequence\nTTTTAAAA');
    });
    await act(async () => {
      file.resolve('>Old file\nACGTACGT');
      await pending;
    });
    expect(result.current.sequenceImportText).toBe(
      '>Manual sequence\nTTTTAAAA',
    );
    expect(result.current.sequenceImportResult?.records[0].name).toBe(
      'Manual sequence',
    );
  });

  it('ignores stale sequence-file errors after a newer file parsed successfully', async () => {
    const { result } = renderHook(useProjectController);
    const older = deferredFile();
    const newer = deferredFile();
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = result.current.handleSequenceFileImport(older.event);
      second = result.current.handleSequenceFileImport(newer.event);
    });
    await act(async () => {
      newer.resolve('>Latest sequence\nACGTACGT');
      await second;
    });
    await act(async () => {
      older.reject(new Error('Old file could not be read'));
      await first;
    });
    expect(result.current.sequenceImportResult?.records[0].name).toBe(
      'Latest sequence',
    );
    expect(result.current.sequenceImportError).toBe('');
  });
});
