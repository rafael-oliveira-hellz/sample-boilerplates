import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from './App';

const mountMock = vi.fn(async ({ hostElement }: { hostElement: HTMLElement }) => {
  hostElement.innerHTML = '<div data-testid="mock-remote">remote carregado</div>';
});

const unmountMock = vi.fn(async () => undefined);

vi.mock('./core/loadRemoteEntry', () => ({
  loadJsonMapperRemote: vi.fn(async () => ({
    mount: mountMock,
    unmount: unmountMock
  }))
}));

vi.mock('./core/loadJsonMapperWidget', () => ({
  loadJsonMapperWidget: vi.fn(async () => (props: { partnerName: string }) => (
    <div data-testid="mock-widget">widget {props.partnerName}</div>
  ))
}));

describe('HostShell App', () => {
  it('monta o remote federado e renderiza o contexto do shell', async () => {
    render(<App />);

    expect(screen.getByText('Plataforma corporativa de microfrontends em React')).toBeInTheDocument();
    expect(screen.getByText('mfe-json-mapper-react')).toBeInTheDocument();
    expect(screen.getByText('Três formas de consumo')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('mock-remote')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Remote montado')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('mock-widget')).toBeInTheDocument());
    expect(mountMock).toHaveBeenCalledTimes(1);
  });
});
