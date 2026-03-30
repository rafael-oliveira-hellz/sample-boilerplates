import React from 'react';
import { render, screen } from '@testing-library/react';
import { DEFAULT_SHELL_CONTEXT } from '@porto/shared-contracts';
import { ShellContextProvider } from '@porto/shared-runtime';
import { JsonMapperRewriteWorkspace } from './JsonMapperRewriteWorkspace';

describe('JsonMapperRewriteWorkspace', () => {
  it('renderiza o inspector React junto com source e target nativos', () => {
    render(
      <ShellContextProvider context={DEFAULT_SHELL_CONTEXT}>
        <JsonMapperRewriteWorkspace />
      </ShellContextProvider>
    );

    expect(screen.getByTestId('react-source-panel')).toBeInTheDocument();
    expect(screen.getByTestId('react-target-panel')).toBeInTheDocument();
    expect(screen.getByTestId('react-workbench-panel')).toBeInTheDocument();
    expect(screen.getByTestId('react-metadata-panel')).toBeInTheDocument();
    expect(screen.getByTestId('preview-fab')).toBeInTheDocument();
    expect(screen.queryByTestId('react-rules-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('react-preview-panel')).not.toBeInTheDocument();
    expect(screen.getByText('Campo ou container de destino')).toBeInTheDocument();
    expect(screen.getByText('map_from da origem')).toBeInTheDocument();
  });
});
