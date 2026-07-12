import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

async function loadExampleProject(user: ReturnType<typeof userEvent.setup>, exampleId = 'protein-fusion') {
  await user.selectOptions(screen.getByLabelText('Example library'), exampleId);
  await user.click(screen.getByRole('button', { name: 'Load selected example' }));
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

  it('loads different built-in example projects from the example library', async () => {
    const user = userEvent.setup();
    render(<App />);

    await loadExampleProject(user, 'insertion');
    await user.click(screen.getByRole('button', { name: 'Sequences step' }));

    expect(screen.getByLabelText('Design mode')).toHaveValue('insertion');
    expect(screen.getByRole('heading', { name: 'Recipient-to-flank workflow' })).toBeInTheDocument();
    expect(screen.getByText('Left and right flanks plus an inserted payload sequence.')).toBeInTheDocument();
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

  it('applies the mutation planner workflow to the current project', async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadExampleProject(user, 'insertion');
    await user.click(screen.getByRole('button', { name: 'Sequences step' }));

    fireEvent.change(screen.getByLabelText('Mutation payload'), { target: { value: 'ATGC' } });
    fireEvent.change(screen.getByLabelText('Insertion coordinate'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply mutation workflow' }));

    await user.click(screen.getByRole('button', { name: 'Sequences step' }));
    expect((screen.getByLabelText('Project notes') as HTMLTextAreaElement).value).toContain('Insert 4 bp at coordinate 5');
    expect(screen.getByPlaceholderText('Optional inserted sequence between the selected fragment ranges')).toHaveValue('ATGC');
  });

  it('pins a compare snapshot and keeps current and baseline values side by side after edits', async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadExampleProject(user);
    await user.click(screen.getByRole('button', { name: 'Construct step' }));
    await user.click(screen.getByText('Advanced settings'));

    await user.click(screen.getByRole('button', { name: 'Pin current design' }));
    expect(screen.getByRole('button', { name: 'Refresh pinned design' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sequences step' }));
    fireEvent.change(screen.getByPlaceholderText('Optional inserted sequence between the selected fragment ranges'), {
      target: { value: 'GGTGGT' },
    });

    await user.click(screen.getByRole('button', { name: 'Construct step' }));
    await user.click(screen.getByText('Advanced settings'));
    const totalOligoRow = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Total oligo nt'));

    expect(totalOligoRow).toBeDefined();
    const cells = within(totalOligoRow as HTMLElement).getAllByRole('cell');
    expect(cells[1].textContent).not.toBe(cells[2].textContent);
  });

  it('exports a validation report through the browser download path', async () => {
    const user = userEvent.setup();
    const { createObjectURL, revokeObjectURL, clickSpy } = installDownloadSpies();
    render(<App />);
    await loadExampleProject(user);
    await user.click(screen.getByRole('button', { name: 'Export step' }));

    await user.click(screen.getByRole('button', { name: 'Export validation report' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('reloads the saved project state from localStorage on remount', async () => {
    const firstRender = render(<App />);

    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Persisted browser project' } });

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
