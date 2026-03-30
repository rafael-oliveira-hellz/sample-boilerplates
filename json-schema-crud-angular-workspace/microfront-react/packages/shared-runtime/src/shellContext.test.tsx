import React from 'react';
import { render, screen } from '@testing-library/react';
import { DEFAULT_SHELL_CONTEXT } from '@porto/shared-contracts';
import { ShellContextProvider, useShellContext } from './shellContext';

function Probe(): JSX.Element {
  const context = useShellContext();
  return <span>{context.session.tenantId}</span>;
}

describe('ShellContextProvider', () => {
  it('disponibiliza o contexto tipado para o remote', () => {
    render(
      <ShellContextProvider context={DEFAULT_SHELL_CONTEXT}>
        <Probe />
      </ShellContextProvider>
    );

    expect(screen.getByText('porto')).toBeInTheDocument();
  });
});
