import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';

const sourceSchemaPath = path.resolve(
  __dirname,
  '..',
  'public',
  'examples',
  'schema-origem-exemplo.json'
);
const targetSchemaPath = path.resolve(
  __dirname,
  '..',
  'public',
  'examples',
  'schema-destino-exemplo.json'
);

async function openJsonMode(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: 'JSON' }).click();
}

async function openBuilderMode(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: 'Builder' }).click();
}

async function importSchemaFile(panel: Locator, filePath: string): Promise<void> {
  await openJsonMode(panel);
  await panel.locator('input[type="file"]').setInputFiles(filePath);
}

async function importSchemaContent(
  panel: Locator,
  fileName: string,
  content: Record<string, unknown>
): Promise<void> {
  await openJsonMode(panel);
  await panel.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(content, null, 2), 'utf-8')
  });
}

test.describe('Mapper app', () => {
  test('renders the main workspace', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Mapeador visual de schemas JSON' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar na API' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Carregar última configuração' })).toBeVisible();
    await expect(page.getByTestId('source-panel')).toBeVisible();
    await expect(page.getByTestId('mapping-workbench')).toBeVisible();
    await expect(page.getByTestId('target-panel')).toBeVisible();
    await expect(page.getByText('Carregando preview estruturado...')).toBeVisible();
  });

  test('salva e recarrega a ultima configuracao mantendo o destino visual', async ({ page }) => {
    let lastSavedDocument: Record<string, unknown> | null = null;

    await page.route('http://localhost:8080/api/configs', async (route) => {
      const request = route.request();
      const requestBody = request.postDataJSON() as Record<string, unknown>;
      lastSavedDocument = {
        id: '845b5fe5-de7e-4e7b-afda-11581b0760b7',
        ...requestBody
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lastSavedDocument)
      });
    });

    await page.route('http://localhost:8080/api/configs/latest**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          lastSavedDocument ?? {
            id: '845b5fe5-de7e-4e7b-afda-11581b0760b7',
            codigo_parceiro: 1001,
            tipo_schema: 'destino',
            versao_schema: 'v1',
            id_evento: '11111111-1111-1111-1111-111111111111',
            schema_origem: {},
            schema_destino: {}
          }
        )
      });
    });

    await page.goto('/');

    const sourcePanel = page.getByTestId('source-panel');
    const targetPanel = page.getByTestId('target-panel');

    await importSchemaFile(sourcePanel, sourceSchemaPath);
    await expect(sourcePanel.getByText('schema-origem-exemplo.json')).toBeVisible();

    await importSchemaFile(targetPanel, targetSchemaPath);
    await expect(targetPanel.getByText('schema-destino-exemplo.json')).toBeVisible();

    await openBuilderMode(targetPanel);
    await expect(
      targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.contrato.numero"]')
    ).toBeVisible();
    await expect(
      targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.proposta.id"]')
    ).toBeVisible();
    await expect(
      targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.tipoContrato"]')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Salvar na API' }).click();
    await expect(page.getByText(/Configuracao salva com sucesso/i)).toBeVisible();

    expect(lastSavedDocument).not.toBeNull();
    expect(lastSavedDocument?.['schema_destino']).toMatchObject({
      properties: {
        data: {
          properties: {
            contrato: {
              properties: {
                numero: {
                  concat: {
                    alias: [
                      'dadosApolice.codigoSucursal',
                      'dadosApolice.ramo',
                      'dadosApolice.numeroApolice',
                      'dadosApolice.numeroItem'
                    ]
                  }
                }
              }
            },
            proposta: {
              properties: {
                id: {
                  concat: {
                    alias: [
                      'dadosApolice.origemPropostaPrincipal',
                      'dadosApolice.numeroPropostaPrincipal'
                    ]
                  }
                }
              }
            }
          }
        }
      }
    });

    await page.getByRole('button', { name: 'Carregar última configuração' }).click();
    await expect(page.getByText(/Última configuração carregada|Ultima configuracao carregada/i)).toBeVisible();

    await openBuilderMode(targetPanel);
    await expect(
      targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.contrato.numero"]')
    ).toBeVisible();
    await expect(
      targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.proposta.id"]')
    ).toBeVisible();
    await expect(
      targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.marcaDescricao"]')
    ).toBeVisible();

    await expect(
      targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.contrato.numero"] .map-badge')
    ).toBeVisible();
    await expect(
      targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.proposta.id"] .map-badge')
    ).toBeVisible();
  });

  test('recarrega bindings de concat, defaultSource, eval e script no inspector', async ({ page }) => {
    let lastSavedDocument: Record<string, unknown> | null = null;

    const customSourceSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        dadosApolice: {
          type: 'object',
          properties: {
            codigoSucursal: { type: 'integer' },
            numeroApolice: { type: 'integer' },
            numeroItem: { type: 'integer' },
            idMediacao: { type: 'string' },
            codigoMarca: { type: 'integer' },
            valor: { type: 'number' }
          }
        }
      }
    };

    const customTargetSchema = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            contrato: {
              type: 'object',
              properties: {
                numero: {
                  type: 'string',
                  concat: {
                    alias: [
                      'dadosApolice.codigoSucursal',
                      'dadosApolice.numeroApolice',
                      'dadosApolice.numeroItem'
                    ]
                  }
                }
              }
            },
            proposta: {
              type: 'object',
              properties: {
                idMediacao: {
                  type: 'string',
                  default: 'dadosApolice.idMediacao'
                }
              }
            },
            marcaDescricao: {
              type: 'string',
              eval: {
                alias: "dadosApolice.codigoMarca == 1001 ? 'Porto' : null"
              }
            },
            totalCalculado: {
              type: 'script',
              script: {
                language: 'java',
                source: 'return source.get("valor");',
                returnType: 'number'
              }
            }
          }
        }
      }
    };

    await page.route('http://localhost:8080/api/configs', async (route) => {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>;
      lastSavedDocument = {
        id: '2dcb2275-b285-4a20-a339-f5f488d8d59d',
        ...requestBody
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lastSavedDocument)
      });
    });

    await page.route('http://localhost:8080/api/configs/latest**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lastSavedDocument)
      });
    });

    await page.goto('/');

    const sourcePanel = page.getByTestId('source-panel');
    const targetPanel = page.getByTestId('target-panel');
    const workbench = page.getByTestId('mapping-workbench');

    await importSchemaContent(sourcePanel, 'schema-origem-teste.json', customSourceSchema);
    await importSchemaContent(targetPanel, 'schema-destino-teste.json', customTargetSchema);

    await page.getByRole('button', { name: 'Salvar na API' }).click();
    await expect(page.getByText(/Configuracao salva com sucesso/i)).toBeVisible();

    await page.getByRole('button', { name: 'Carregar última configuração' }).click();
    await expect(page.getByText(/Última configuração carregada|Ultima configuracao carregada/i)).toBeVisible();

    await openBuilderMode(targetPanel);

    const concatNode = targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.contrato.numero"]');
    await concatNode.click();
    await expect(workbench.getByTestId('binding-mode-concat')).toHaveClass(/active/);
    const sourceStrip = workbench.locator('.source-strip');
    await expect(sourceStrip.getByText('dadosApolice.codigoSucursal')).toBeVisible();
    await expect(sourceStrip.getByText('dadosApolice.numeroApolice')).toBeVisible();
    await expect(sourceStrip.getByText('dadosApolice.numeroItem')).toBeVisible();

    const defaultSourceNode = targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.proposta.idMediacao"]');
    await defaultSourceNode.click();
    await expect(workbench.getByTestId('binding-mode-defaultSource')).toHaveClass(/active/);
    await expect(workbench.getByText('Origem do default')).toBeVisible();
    await expect(workbench.locator('.source-strip').getByText('dadosApolice.idMediacao')).toBeVisible();

    const evalNode = targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.marcaDescricao"]');
    await evalNode.click();
    await expect(workbench.getByTestId('binding-mode-eval')).toHaveClass(/active/);
    await expect(workbench.getByText('Expressao eval')).toBeVisible();
    await expect(workbench.getByText('eval-expression.ts')).toBeVisible();

    const scriptNode = targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.totalCalculado"]');
    await scriptNode.click();
    await expect(workbench.getByTestId('binding-mode-script')).toHaveClass(/active/);
    await expect(workbench.getByText('Script do payload final')).toBeVisible();
    await expect(workbench.getByTestId('script-return-type-select')).toHaveValue('number');
    await expect(workbench.getByText('transform-script.java')).toBeVisible();
  });

  test('salva e recarrega map_from com arrays aninhados em cascata na origem e no destino', async ({ page }) => {
    let lastSavedDocument: Record<string, unknown> | null = null;

    const deepSourceSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        apolice: {
          type: 'object',
          properties: {
            produtor: {
              type: 'object',
              properties: {
                cnpj: { type: 'string' }
              }
            },
            pacotes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  codigoPacote: { type: 'string' },
                  itens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        codigoItem: { type: 'string' },
                        coberturas: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              codigoCobertura: { type: 'string' },
                              valor: { type: 'number' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    const deepTargetSchema = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            pacotes: {
              type: 'array',
              map_from: {
                alias: ['apolice.pacotes']
              },
              items: {
                type: 'object',
                properties: {
                  pacoteId: {
                    type: 'string',
                    alias: ['codigoPacote']
                  },
                  itens: {
                    type: 'array',
                    map_from: {
                      alias: ['itens']
                    },
                    items: {
                      type: 'object',
                      properties: {
                        itemId: {
                          type: 'string',
                          alias: ['codigoItem']
                        },
                        coberturas: {
                          type: 'array',
                          map_from: {
                            alias: ['coberturas']
                          },
                          items: {
                            type: 'object',
                            properties: {
                              coberturaId: {
                                type: 'string',
                                alias: ['codigoCobertura']
                              },
                              valorCobertura: {
                                type: 'number',
                                alias: ['valor']
                              },
                              produtorCnpj: {
                                type: 'string',
                                alias: ['apolice.produtor.cnpj']
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            pacotesResumo: {
              type: 'array',
              map_from: {
                alias: ['apolice.pacotes']
              },
              items: {
                type: 'object',
                properties: {
                  codigo: {
                    type: 'string',
                    alias: ['codigoPacote']
                  },
                  itensResumo: {
                    type: 'array',
                    map_from: {
                      alias: ['itens']
                    },
                    items: {
                      type: 'object',
                      properties: {
                        codigo: {
                          type: 'string',
                          alias: ['codigoItem']
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

    await page.route('http://localhost:8080/api/configs', async (route) => {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>;
      lastSavedDocument = {
        id: '9effdc5b-5fe5-42b6-b70d-17f61efcebad',
        ...requestBody
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lastSavedDocument)
      });
    });

    await page.route('http://localhost:8080/api/configs/latest**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(lastSavedDocument)
      });
    });

    await page.goto('/');

    const sourcePanel = page.getByTestId('source-panel');
    const targetPanel = page.getByTestId('target-panel');
    const workbench = page.getByTestId('mapping-workbench');
    await importSchemaContent(sourcePanel, 'schema-origem-profundo.json', deepSourceSchema);
    await importSchemaContent(targetPanel, 'schema-destino-profundo.json', deepTargetSchema);

    await page.getByRole('button', { name: 'Salvar na API' }).click();
    await expect(page.getByText(/Configuracao salva com sucesso/i)).toBeVisible();

    expect(lastSavedDocument?.['schema_destino']).toMatchObject({
      properties: {
        data: {
          properties: {
            pacotes: {
              map_from: {
                alias: ['apolice.pacotes'],
                items: {
                  properties: {
                    itens: {
                      map_from: {
                        alias: ['itens'],
                        items: {
                          properties: {
                            coberturas: {
                              map_from: {
                                alias: ['coberturas']
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            pacotesResumo: {
              map_from: {
                alias: ['apolice.pacotes']
              }
            }
          }
        }
      }
    });

    await page.getByRole('button', { name: /Carregar/i }).click();
    await expect(page.getByText(/Ãšltima configuraÃ§Ã£o carregada|Ultima configuracao carregada/i)).toBeVisible();

    await openBuilderMode(targetPanel);

    const pacotesArray = targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.pacotes"]');
    const resumoArray = targetPanel.locator('[data-testid="target-node-card"][data-node-path="data.pacotesResumo"]');

    await expect(pacotesArray).toBeVisible();
    await expect(resumoArray).toBeVisible();

    await pacotesArray.click();
    await expect(workbench.locator('.binding-block select').first()).toHaveValue('$.apolice.pacotes');
    await resumoArray.click();
    await expect(workbench.locator('.binding-block select').first()).toHaveValue('$.apolice.pacotes');
  });
});
