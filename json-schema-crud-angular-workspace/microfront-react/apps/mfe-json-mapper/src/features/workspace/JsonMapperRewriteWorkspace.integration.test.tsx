import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ShellContextProvider } from '@porto/shared-runtime';
import type { ShellContext } from '@porto/shared-contracts';
import { JsonMapperRewriteWorkspace } from './JsonMapperRewriteWorkspace';

const shellContext: ShellContext = {
  session: {
    userId: 'qa-user',
    tenantId: 'porto',
    roles: ['admin']
  },
  locale: 'pt-BR',
  theme: 'porto-light',
  featureFlags: {},
  apiBaseUrl: 'http://localhost:8080/api',
  appName: 'mfe-json-mapper-react'
};

const sourceSchema = {
  type: 'object',
  properties: {
    dadosApolice: {
      type: 'object',
      properties: {
        codigoMarca: { type: 'integer' },
        numeroApolice: { type: 'integer' }
      }
    }
  }
};

const targetSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        marcaDescricao: {
          type: 'string',
          eval: {
            alias: 'dadosApolice.codigoMarca == 1001 ? "Porto" : null'
          }
        }
      }
    }
  }
};

function renderWorkspace(): void {
  render(
    <ShellContextProvider context={shellContext}>
      <JsonMapperRewriteWorkspace />
    </ShellContextProvider>
  );
}

describe('JsonMapperRewriteWorkspace integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('salva o documento persistido usando os schemas atuais', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'cfg-react-1' })
    }));

    vi.stubGlobal('fetch', fetchMock);
    renderWorkspace();

    const sourcePanel = screen.getByTestId('react-source-panel');
    const targetPanel = screen.getByTestId('react-target-panel');

    fireEvent.click(within(sourcePanel).getByRole('button', { name: 'JSON' }));
    fireEvent.change(within(sourcePanel).getByPlaceholderText('Cole o JSON Schema de origem aqui.'), {
      target: { value: JSON.stringify(sourceSchema, null, 2) }
    });
    fireEvent.click(within(sourcePanel).getByRole('button', { name: 'Aplicar texto' }));

    fireEvent.click(within(targetPanel).getByRole('button', { name: 'JSON' }));
    fireEvent.change(within(targetPanel).getByPlaceholderText('Cole o JSON Schema de destino aqui.'), {
      target: { value: JSON.stringify(targetSchema, null, 2) }
    });
    fireEvent.click(within(targetPanel).getByRole('button', { name: 'Aplicar texto' }));

    fireEvent.click(screen.getByRole('button', { name: 'Salvar na API' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('http://localhost:8080/api/configs');
    expect(requestInit.method).toBe('POST');

    const body = JSON.parse(String(requestInit.body));
    expect(body.nome_parceiro).toBe('porto_teste_1');
    expect(body.schema_origem.properties.dadosApolice.properties.codigoMarca.type).toBe('integer');
    expect(body.schema_destino.properties.data.properties.marcaDescricao.eval.alias).toContain('dadosApolice.codigoMarca');

    await waitFor(() => expect(screen.getByText('Configuração salva com ID cfg-react-1.')).toBeInTheDocument());
  });

  it('carrega a última configuração do backend e atualiza o JSON técnico', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'cfg-react-latest',
        nome_parceiro: 'porto_teste_1',
        tipo_schema: 'destino',
        versao_schema: 'v1',
        evento_parceiro: 'emissao',
        schema_origem: sourceSchema,
        schema_destino: targetSchema
      })
    }));

    vi.stubGlobal('fetch', fetchMock);
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar última configuração' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Última configuração carregada: cfg-react-latest.')).toBeInTheDocument());

    const targetPanel = screen.getByTestId('react-target-panel');
    fireEvent.click(within(targetPanel).getByRole('button', { name: 'JSON' }));

    expect(within(targetPanel).getByPlaceholderText('Cole o JSON Schema de destino aqui.')).toHaveValue(JSON.stringify(targetSchema, null, 2));
  });

  it('permite criar campos manuais e arrastar da origem para o destino no builder', async () => {
    renderWorkspace();

    const sourcePanel = screen.getByTestId('react-source-panel');
    const targetPanel = screen.getByTestId('react-target-panel');

    fireEvent.click(within(sourcePanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(sourcePanel).getByLabelText('Nome'), {
      target: { value: 'codigoMarca' }
    });
    fireEvent.change(within(sourcePanel).getByLabelText('Tipo'), {
      target: { value: 'integer' }
    });

    fireEvent.click(within(targetPanel).getByRole('button', { name: '+ Objeto' }));
    fireEvent.change(within(targetPanel).getByLabelText('Nome'), {
      target: { value: 'data' }
    });

    const sourceNode = within(sourcePanel).getByRole('button', { name: /codigoMarca/i });
    const targetNode = within(targetPanel).getByRole('button', { name: /data/i });

    fireEvent.dragStart(sourceNode, {
      dataTransfer: {
        effectAllowed: 'copy',
        setData: vi.fn(),
        getData: vi.fn(() => '$.codigoMarca')
      }
    });
    fireEvent.dragOver(targetNode, {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: 'copy' }
    });
    fireEvent.drop(targetNode, {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn(() => '$.codigoMarca') }
    });
    fireEvent.dragEnd(sourceNode);

    await waitFor(() => expect(within(targetPanel).getAllByText('codigoMarca').length).toBeGreaterThan(0));

    await waitFor(() => expect(screen.getByLabelText('Origem principal')).toHaveValue('$.codigoMarca'));
  });

  it('faz drop em array do destino criando o campo dentro do item-modelo', async () => {
    renderWorkspace();

    const sourcePanel = screen.getByTestId('react-source-panel');
    const targetPanel = screen.getByTestId('react-target-panel');

    fireEvent.click(within(sourcePanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(sourcePanel).getByLabelText('Nome'), {
      target: { value: 'codigoMarca' }
    });

    fireEvent.click(within(targetPanel).getByRole('button', { name: '+ Array' }));
    fireEvent.change(within(targetPanel).getByLabelText('Nome'), {
      target: { value: 'itens' }
    });

    const sourceNode = within(sourcePanel).getByRole('button', { name: /codigoMarca/i });
    const targetArrayNode = within(targetPanel).getByLabelText('Renomear itens').closest('button');

    expect(targetArrayNode).not.toBeNull();

    fireEvent.dragStart(sourceNode, {
      dataTransfer: {
        effectAllowed: 'copy',
        setData: vi.fn(),
        getData: vi.fn(() => '$.codigoMarca')
      }
    });
    fireEvent.dragOver(targetArrayNode as HTMLElement, {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: 'copy' }
    });
    fireEvent.drop(targetArrayNode as HTMLElement, {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn(() => '$.codigoMarca') }
    });
    fireEvent.dragEnd(sourceNode);

    await waitFor(() => expect(within(targetPanel).getAllByText('codigoMarca').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText('$.itens[0].codigoMarca')).toBeInTheDocument());
  });

  it('usa alias relativo quando o array do destino tem map_from apontando para a coleção da origem', async () => {
    renderWorkspace();

    const sourcePanel = screen.getByTestId('react-source-panel');
    const targetPanel = screen.getByTestId('react-target-panel');

    fireEvent.click(within(sourcePanel).getByRole('button', { name: '+ Array' }));
    fireEvent.change(within(sourcePanel).getByLabelText('Nome'), {
      target: { value: 'itens' }
    });
    fireEvent.click(within(sourcePanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(sourcePanel).getByLabelText('Nome'), {
      target: { value: 'codigoMarca' }
    });

    fireEvent.click(within(targetPanel).getByRole('button', { name: '+ Array' }));
    fireEvent.change(within(targetPanel).getByLabelText('Nome'), {
      target: { value: 'itensDestino' }
    });

    fireEvent.change(screen.getByLabelText('map_from da origem'), {
      target: { value: '$.itens' }
    });

    const sourceNode = within(sourcePanel).getByRole('button', { name: /codigoMarca/i });
    const targetArrayNode = within(targetPanel).getByLabelText('Renomear itensDestino').closest('button');

    expect(targetArrayNode).not.toBeNull();

    fireEvent.dragStart(sourceNode, {
      dataTransfer: {
        effectAllowed: 'copy',
        setData: vi.fn(),
        getData: vi.fn(() => '$.itens[0].codigoMarca')
      }
    });
    fireEvent.dragOver(targetArrayNode as HTMLElement, {
      preventDefault: vi.fn(),
      dataTransfer: { dropEffect: 'copy' }
    });
    fireEvent.drop(targetArrayNode as HTMLElement, {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn(() => '$.itens[0].codigoMarca') }
    });
    fireEvent.dragEnd(sourceNode);

    await waitFor(() => expect(within(targetPanel).getAllByText('codigoMarca').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByLabelText('Origem principal')).toHaveValue('$.codigoMarca'));
  });

  it('aplica a melhor sugestão pelo workbench quando origem e destino têm nomes compatíveis', async () => {
    renderWorkspace();

    const sourcePanel = screen.getByTestId('react-source-panel');
    const targetPanel = screen.getByTestId('react-target-panel');

    fireEvent.click(within(sourcePanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(sourcePanel).getByLabelText('Nome'), {
      target: { value: 'codigoMarca' }
    });

    fireEvent.click(within(targetPanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(targetPanel).getByLabelText('Nome'), {
      target: { value: 'codigoMarca' }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Abrir assistentes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Melhor sugestão' }));

    await waitFor(() => expect(screen.getByLabelText('Origem principal')).toHaveValue('$.codigoMarca'));
  });
  it('destaca a porta equivalente no destino quando o usuario passa o mouse sobre um segmento do concat', async () => {
    renderWorkspace();

    const sourcePanel = screen.getByTestId('react-source-panel');
    const targetPanel = screen.getByTestId('react-target-panel');

    fireEvent.click(within(sourcePanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(sourcePanel).getByLabelText('Nome'), {
      target: { value: 'codigoSucursal' }
    });
    fireEvent.click(within(sourcePanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(sourcePanel).getByLabelText('Nome'), {
      target: { value: 'numeroApolice' }
    });

    fireEvent.click(within(targetPanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(targetPanel).getByLabelText('Nome'), {
      target: { value: 'numero' }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Concat' }));
    fireEvent.change(screen.getByLabelText('Adicionar origem ao concat'), {
      target: { value: '$.codigoSucursal' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    fireEvent.change(screen.getByLabelText('Adicionar origem ao concat'), {
      target: { value: '$.numeroApolice' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    const entradaDois = screen.getByText('Entrada 2').closest('.segment-card');
    expect(entradaDois).not.toBeNull();
    fireEvent.mouseEnter(entradaDois as HTMLElement);

    await waitFor(() => {
      const portas = Array.from(targetPanel.querySelectorAll('.fan-in-port'));
      expect(portas[1]).toHaveClass('highlighted');
    });

    fireEvent.mouseLeave(entradaDois as HTMLElement);

    await waitFor(() => {
      const portas = Array.from(targetPanel.querySelectorAll('.fan-in-port'));
      expect(portas[0]).not.toHaveClass('highlighted');
      expect(portas[1]).not.toHaveClass('highlighted');
    });
  });

  it('permite ligar uma origem ao inspector pelo link builder visual', async () => {
    renderWorkspace();

    const sourcePanel = screen.getByTestId('react-source-panel');
    const targetPanel = screen.getByTestId('react-target-panel');
    const workbenchPanel = screen.getByTestId('react-workbench-panel');

    fireEvent.click(within(sourcePanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(sourcePanel).getByLabelText('Nome'), {
      target: { value: 'codigoMarca' }
    });

    fireEvent.click(within(targetPanel).getByRole('button', { name: '+ Campo' }));
    fireEvent.change(within(targetPanel).getByLabelText('Nome'), {
      target: { value: 'marcaDescricao' }
    });

    fireEvent.click(within(workbenchPanel).getByRole('button', { name: 'Abrir assistentes' }));

    const sourceNode = within(sourcePanel).getByRole('button', { name: /codigoMarca/i });
    const concatLane = within(workbenchPanel).getAllByRole('button', { name: /Concat/i })[1];

    fireEvent.dragStart(sourceNode, {
      dataTransfer: {
        effectAllowed: 'copy',
        setData: vi.fn(),
        getData: vi.fn(() => '$.codigoMarca')
      }
    });
    fireEvent.dragOver(concatLane, {
      preventDefault: vi.fn(),
      dataTransfer: {
        dropEffect: 'copy',
        getData: vi.fn(() => '$.codigoMarca')
      }
    });
    fireEvent.drop(concatLane, {
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn(() => '$.codigoMarca')
      }
    });
    fireEvent.dragEnd(sourceNode);

    await waitFor(() => expect(within(workbenchPanel).getByText('Entrada 1')).toBeInTheDocument());
    await waitFor(() => {
      const chips = Array.from(workbenchPanel.querySelectorAll('.token-chip--full')).map((element) => element.textContent?.trim());
      expect(chips).toContain('codigoMarca');
    });
  });
});
