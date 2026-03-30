import React from 'react';
import { render, screen } from '@testing-library/react';
import { DEFAULT_SHELL_CONTEXT } from '@porto/shared-contracts';
import { ShellContextProvider } from '@porto/shared-runtime';
import { App } from './App';

describe('App', () => {
  it('renderiza o produto React com a estrutura principal do mapper', () => {
    render(
      <ShellContextProvider context={DEFAULT_SHELL_CONTEXT}>
        <App />
      </ShellContextProvider>
    );

    expect(screen.getByText('Mapeador JSON visual para contratos de integração')).toBeInTheDocument();
    expect(screen.getByTestId('react-json-mapper-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('preview-fab')).toBeInTheDocument();
  });
});
