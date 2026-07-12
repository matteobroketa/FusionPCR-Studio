import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

function installDownloadSpies() {
  const createObjectURL = vi.fn(() => 'blob:test');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL,
    revokeObjectURL,
  });
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { createObjectURL, revokeObjectURL, clickSpy };
}

async function enterSequenceWorkbench(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Import sequences' }));
}

async function loadExampleProject(user: ReturnType<typeof userEvent.setup>, exampleId: 'protein-fusion' | 'exact-fusion' = 'protein-fusion') {
  const expectedNames: Record<string, string> = {
    'protein-fusion': 'Protein fusion demo',
    'exact-fusion': 'Exact fusion example',
  };
  const buttonName = exampleId === 'exact-fusion' ? 'Load exact fusion example' : 'Load protein fusion example';
  const exampleButton = screen.queryByRole('button', { name: buttonName });
  if (exampleButton) {
    await user.click(exampleButton);
  } else {
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: buttonName }));
  }
  const confirmButton = screen.queryByRole('button', { name: 'Load built-in example' });
  if (confirmButton) {
    await user.click(confirmButton);
  }
  await waitFor(() => {
    expect(screen.getByLabelText('Project name')).toHaveValue(expectedNames[exampleId]);
  });
}

describe('App browser flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads the supported built-in examples from the public MVP surface', async () => {
    const user = userEvent.setup();
    render(<App />);

    await loadExampleProject(user, 'exact-fusion');
    await user.click(screen.getByRole('button', { name: 'Sequences step' }));

    expect(screen.getByLabelText('Design mode')).toHaveValue('exact');
    expect(screen.getByPlaceholderText('Optional inserted sequence between the selected fragment ranges')).toBeInTheDocument();

    await loadExampleProject(user, 'protein-fusion');
    await user.click(screen.getByRole('button', { name: 'Sequences step' }));
    expect(screen.getByLabelText('Design mode')).toHaveValue('protein-fusion');
  });

  it('parses sequence import text and applies the first two records to the project', async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterSequenceWorkbench(user);

    fireEvent.change(screen.getByLabelText('Import text'), {
      target: {
        value: '>Example_A\nATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG\n>Example_B\nGGCAGCGGCGGATCCGATGGTGAGCAAGGGCGAGGAGCTG',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Parse import text' }));

    expect(screen.getByText('Parsed 2 record(s) as fasta.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply first two records' }));

    expect(screen.getByRole('button', { name: /Example_A/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Example_B/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sequences step' }));
    expect(screen.getByDisplayValue('Example_A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Example_B')).toBeInTheDocument();
  });

  it('confirms replacement and restores the previous project snapshot', async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadExampleProject(user, 'exact-fusion');

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Load protein fusion example' }));

    expect(screen.getByRole('heading', { name: 'Replace current project?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load built-in example' }));
    await waitFor(() => expect(screen.getByLabelText('Project name')).toHaveValue('Protein fusion demo'));

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Restore previous project' }));
    await waitFor(() => expect(screen.getByLabelText('Project name')).toHaveValue('Exact fusion example'));
  });

  it('pins a compare snapshot and keeps current and baseline values side by side after edits', async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadExampleProject(user);
    await user.click(screen.getByRole('button', { name: 'Junction step' }));
    await user.click(screen.getByText('Advanced settings'));

    await user.click(screen.getByRole('button', { name: 'Pin current design' }));
    expect(screen.getByRole('button', { name: 'Refresh pinned design' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sequences step' }));
    fireEvent.change(screen.getByPlaceholderText('Optional inserted sequence between the selected fragment ranges'), {
      target: { value: 'GGTGGT' },
    });

    await user.click(screen.getByRole('button', { name: 'Junction step' }));
    await user.click(screen.getByText('Advanced settings'));
    const totalOligoRow = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Total oligo nt'));

    expect(totalOligoRow).toBeDefined();
    await waitFor(() => {
      const cells = within(totalOligoRow as HTMLElement).getAllByRole('cell');
      expect(cells[1].textContent).not.toBe(cells[2].textContent);
    });
  });

  it('enables export actions for a current clean design', async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadExampleProject(user, 'exact-fusion');
    await user.click(screen.getByRole('button', { name: 'Protocol & Export step' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download oligo CSV' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Export project JSON' })).toBeEnabled();
    });
  });

  it('prevents exporting a stale primer set immediately after a sequence edit', async () => {
    const user = userEvent.setup();
    const { clickSpy } = installDownloadSpies();
    render(<App />);
    await loadExampleProject(user);

    await user.click(screen.getByRole('button', { name: 'Sequences step' }));
    fireEvent.change(screen.getByPlaceholderText('Optional inserted sequence between the selected fragment ranges'), {
      target: { value: 'GGTGGT' },
    });

    await user.click(screen.getByRole('button', { name: 'Protocol & Export step' }));

    const exportButton = screen.getByRole('button', { name: 'Download oligo CSV' });
    expect(exportButton).toBeDisabled();
    await user.click(exportButton);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('reloads the saved project state from localStorage on remount', async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);
    await loadExampleProject(user, 'exact-fusion');

    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Persisted browser project' } });
    await waitFor(() => expect(window.localStorage.getItem('fusionpcr-studio-project')).toContain('Persisted browser project'));

    firstRender.unmount();
    render(<App />);

    expect(screen.getByLabelText('Project name')).toHaveValue('Persisted browser project');
  });

  it('applies imported GenBank feature ranges to fragment coordinates', async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterSequenceWorkbench(user);

    fireEvent.change(screen.getByLabelText('Import text'), {
      target: {
        value: `LOCUS       TESTSEQ         39 bp    DNA     linear SYN 11-JUL-2026
FEATURES             Location/Qualifiers
     CDS             4..18
                     /gene="orfA"
ORIGIN
        1 atggccattgtaatgggccgctgaaagggtgcccgatag
//
`,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Parse import text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use for fragment A' }));
    await user.click(screen.getByRole('button', { name: 'Sequences step' }));

    const featureButton = screen.getAllByRole('button', { name: 'Use feature range' })[0];
    fireEvent.click(featureButton);

    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('18')).toBeInTheDocument();
    expect(screen.getByText(/orfA applied as 4-18/)).toBeInTheDocument();
  });
});
