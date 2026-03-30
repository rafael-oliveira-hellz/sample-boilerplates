import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MapperFacadeService } from './mapper-facade.service';

describe('MapperFacadeService', () => {
  let service: MapperFacadeService;
  let httpMock: HttpTestingController;

  const seedSampleSchemas = () => {
    service.updateSourceJsonText(
      JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          dadosApolice: {
            type: 'object',
            properties: {
              codigoSucursal: { type: 'integer' },
              numeroApolice: { type: 'integer' },
              numeroPropostaPrincipal: { type: 'integer' },
              numeroItem: { type: 'integer' },
              ramo: { type: 'integer' },
              codigoMarca: { type: 'integer' }
            }
          },
          dadosCondutor: {
            type: 'object',
            properties: {
              nome: { type: 'string' }
            }
          }
        }
      })
    );
    service.updateTargetJsonText(
      JSON.stringify({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              contrato: {
                type: 'object',
                properties: {
                  numero: { type: 'string' }
                }
              },
              proposta: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  idMediacao: { type: 'string' }
                }
              },
              tip: { type: 'string' }
            }
          }
        }
      })
    );
    service.importSourceSchema();
    service.importTargetSchema();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(MapperFacadeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should bootstrap source and target trees vazio por padrao', () => {
    expect(service.sourceTree().length).toBe(1);
    expect(service.targetTree().length).toBe(1);
    expect(service.sourceLeafOptions().length).toBe(0);
    expect(service.targetLeafOptions().length).toBe(0);
    expect(service.sourceTree()[0].displayPath).toBe('origem');
    expect(service.targetTree()[0].displayPath).toBe('destino');
  });

  it('should import source and target schema from raw json', () => {
    service.updateSourceJsonText(
      JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          dadosApolice: {
            type: 'object',
            properties: {
              numeroApolice: { type: 'integer' }
            }
          }
        }
      })
    );
    service.updateTargetJsonText(
      JSON.stringify({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              proposta: {
                type: 'object',
                properties: {
                  id: { type: 'string' }
                }
              }
            }
          }
        }
      })
    );

    service.importSourceSchema();
    service.importTargetSchema();

    expect(service.sourceLeafOptions().some((node) => node.displayPath == 'dadosApolice.numeroApolice')).toBeTrue();
    expect(service.targetLeafOptions().some((node) => node.displayPath == 'data.proposta.id')).toBeTrue();
  });

  it('should import source and target schemas directly from file content', () => {
    service.importSourceSchemaFromText(
      JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          origemRaiz: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigo: { type: 'integer' }
              }
            }
          }
        }
      })
    );
    service.importTargetSchemaFromText(
      JSON.stringify({
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              itens: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    codigo: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      })
    );

    expect(service.sourceJsonText()).toContain('origemRaiz');
    expect(service.targetJsonText()).toContain('data');
    expect(service.sourceNodeOptions().some((node) => node.displayPath == 'origemRaiz')).toBeTrue();
    expect(service.targetLeafOptions().some((node) => node.displayPath == 'data.itens[item].codigo')).toBeTrue();
  });

  it('should reset builders when importing empty raw json', () => {
    service.updateSourceJsonText('');
    service.updateTargetJsonText('');

    service.importSourceSchema();
    service.importTargetSchema();

    expect(service.sourceTree().length).toBe(1);
    expect(service.targetTree().length).toBe(1);
    expect(service.sourceLeafOptions().length).toBe(0);
    expect(service.targetLeafOptions().length).toBe(0);
    expect(service.sourceError()).toBe('');
    expect(service.targetError()).toBe('');
  });

  it('should expose import errors for invalid json', () => {
    service.updateSourceJsonText('{ invalid');
    service.updateTargetJsonText('{ invalid');

    service.importSourceSchema();
    service.importTargetSchema();

    expect(service.sourceError()).toContain('JSON');
    expect(service.targetError()).toContain('JSON');
  });

  it('should fallback to generic import error messages for non-Error throws', () => {
    const schemaImport = (service as unknown as { schemaImport: { parseJsonText: (value: string) => unknown } }).schemaImport;
    spyOn(schemaImport, 'parseJsonText').and.throwError('Falha');
    service.updateSourceJsonText('{ invalid');
    service.importSourceSchema();
    expect(service.sourceError()).toBe('Falha');

    (schemaImport.parseJsonText as jasmine.Spy).and.callFake(() => {
      throw 'quebrou';
    });
    service.updateTargetJsonText('{ invalid');
    service.importTargetSchema();
    expect(service.targetError()).toBe('Falha ao importar destino.');
  });

  it('should bind source field to target field via drop semantics', () => {
    seedSampleSchemas();
    const source = service.sourceLeafOptions().find((node) => node.displayPath == 'dadosApolice.codigoSucursal');
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao');

    expect(source).toBeTruthy();
    expect(target).toBeTruthy();

    service.startDraggingSource(source!.path);
    service.dropOnTargetNode(target!.id);

    const updatedTarget = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updatedTarget?.binding?.mode).toBe('alias');
    expect(updatedTarget?.binding?.sourcePaths).toEqual([source!.path]);
  });

  it('should ignore drop when nothing is being dragged', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao');
    const before = JSON.stringify(service.targetTree());

    service.dropOnTargetNode(target!.id);

    expect(JSON.stringify(service.targetTree())).toBe(before);
  });

  it('should convert alias into concat when dropping a second source', () => {
    seedSampleSchemas();
    const first = service.sourceLeafOptions().find((node) => node.displayPath == 'dadosApolice.codigoSucursal');
    const second = service.sourceLeafOptions().find((node) => node.displayPath == 'dadosApolice.numeroApolice');
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao');

    service.startDraggingSource(first!.path);
    service.dropOnTargetNode(target!.id);
    service.startDraggingSource(second!.path);
    service.dropOnTargetNode(target!.id);

    const updatedTarget = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updatedTarget?.binding?.mode).toBe('concat');
    expect(updatedTarget?.binding?.sourcePaths).toEqual([first!.path, second!.path]);
  });

  it('should allow configuring default literal and default source', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip');
    service.selectTargetNode(target!.id);

    service.setSelectedDefaultLiteral('APOLICE');
    let updatedTarget = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updatedTarget?.binding?.mode).toBe('defaultLiteral');
    expect(updatedTarget?.binding?.defaultValue).toBe('APOLICE');

    service.setSelectedDefaultSource('$.dadosApolice.numeroApolice');
    updatedTarget = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updatedTarget?.binding?.mode).toBe('defaultSource');
    expect(updatedTarget?.binding?.defaultSourcePath).toBe('$.dadosApolice.numeroApolice');
  });

  it('should clear selected binding back to unmapped', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip');
    service.selectTargetNode(target!.id);
    service.setSelectedDefaultLiteral('APOLICE');

    service.clearSelectedBinding();

    expect(service.selectedTargetNode()?.binding?.mode).toBe('unmapped');
  });

  it('should allow configuring eval, script and array map_from on selected targets', () => {
    seedSampleSchemas();
    let target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip');
    service.selectTargetNode(target!.id);
    service.updateSelectedEvalExpression("dadosApolice.numeroApolice ? 'OK' : 'NOK'");

    target = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(target?.binding?.mode).toBe('eval');
    expect(target?.binding?.evalExpression).toContain('dadosApolice.numeroApolice');

    service.updateSelectedScriptLanguage('java');
    service.updateSelectedScriptReturnType('string');
    service.updateSelectedScriptSource('return "ok";');

    target = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(target?.binding?.mode).toBe('script');
    expect(target?.binding?.script?.source).toBe('return "ok";');
    expect(service.errorTargetIds().has(target!.id)).toBeFalse();

    const arrayNode = service.targetTree()[0].children[0];
    service.selectTargetNode(arrayNode.id);
    service.updateSelectedMapFromSource('$.dadosApolice');

    expect(service.selectedTargetNode()?.mapFrom?.sourcePaths).toEqual(['$.dadosApolice']);
  });

  it('should flag eval_type script on selected eval expressions that look like code', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip')!;
    service.selectTargetNode(target.id);

    service.updateSelectedEvalExpression(
      'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\nreturn resultado'
    );

    expect(service.selectedTargetNode()?.binding?.mode).toBe('eval');
    expect(service.selectedTargetNode()?.binding?.evalType).toBe('script');
    expect(service.persistenceDocument().schema_destino).toEqual(
      jasmine.objectContaining({
        properties: jasmine.objectContaining({
          data: jasmine.objectContaining({
            properties: jasmine.objectContaining({
              tip: jasmine.objectContaining({
                eval: jasmine.objectContaining({
                  eval_type: 'script'
                })
              })
            })
          })
        })
      })
    );
  });

  it('should no-op map_from update for selected field nodes', () => {
    seedSampleSchemas();
    const field = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip')!;
    service.selectTargetNode(field.id);

    service.updateSelectedMapFromSource('$.dadosApolice');

    expect(service.selectedTargetNode()?.mapFrom).toBeUndefined();
  });

  it('should clear map_from source paths when an empty path is provided', () => {
    service.updateTargetJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          itens: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigo: { type: 'string' }
              }
            }
          }
        }
      })
    );
    service.importTargetSchema();
    const arrayNode = service.targetTree()[0].children[0];
    service.selectTargetNode(arrayNode.id);

    service.updateSelectedMapFromSource('$.dadosApolice.itens');
    service.updateSelectedMapFromSource('');

    expect(service.selectedTargetNode()?.mapFrom?.sourcePaths).toEqual([]);
  });

  it('should create target fields when dropping over a container node', () => {
    seedSampleSchemas();
    const source = service.sourceLeafOptions().find((node) => node.displayPath == 'dadosCondutor.nome');
    const container = service.targetTree()[0].children[0];

    service.startDraggingSource(source!.path);
    service.dropOnTargetNode(container.id);

    const created = service.targetLeafOptions().find((node) => node.displayPath.endsWith('nome'));
    expect(created).toBeTruthy();
    expect(service.selectedTargetNodeId()).toBe(created!.id);
  });

  it('should add and rename nodes in both builders', () => {
    seedSampleSchemas();
    service.addSourceNode('object');
    expect(service.sourceTree()[0].children.some((node) => node.label.startsWith('novoObjeto'))).toBeTrue();

    const targetRoot = service.targetTree()[0].id;
    service.selectTargetNode(targetRoot);
    service.addTargetNode('field');
    const created = service.targetLeafOptions().find((node) => node.label.startsWith('novoCampo'));
    expect(created).toBeTruthy();

    service.selectTargetNode(created!.id);
    service.renameTargetNode('estadoCivil');
    expect(service.targetLeafOptions().some((node) => node.displayPath.endsWith('estadoCivil'))).toBeTrue();
  });

  it('should update persistence metadata and normalize schema storage field', () => {
    service.updatePersistenceMetadata({ tipoSchema: 'origem' });
    expect(service.persistenceMetadata().schemaStorageField).toBe('schema_origem');

    service.updatePersistenceMetadata({ tipoSchema: 'destino' });
    expect(service.persistenceMetadata().schemaStorageField).toBe('schema_destino');
  });

  it('should select, toggle, expand and collapse nodes in both trees', () => {
    seedSampleSchemas();
    const sourceRoot = service.sourceTree()[0].id;
    const targetRoot = service.targetTree()[0].id;
    const sourceChild = service.sourceTree()[0].children[0].id;
    const targetChild = service.targetTree()[0].children[0].id;

    service.selectSourceNode(sourceChild);
    service.selectTargetNode(targetChild);
    expect(service.selectedSourceNodeId()).toBe(sourceChild);
    expect(service.selectedTargetNodeId()).toBe(targetChild);

    service.toggleSourceNode(sourceRoot);
    service.toggleTargetNode(targetRoot);
    expect(service.sourceTree()[0].expanded).toBeFalse();
    expect(service.targetTree()[0].expanded).toBeFalse();

    service.expandAllSourceNodes();
    service.expandAllTargetNodes();
    expect(service.sourceTree()[0].expanded).toBeTrue();
    expect(service.targetTree()[0].expanded).toBeTrue();

    service.collapseAllSourceNodes();
    service.collapseAllTargetNodes();
    expect(service.sourceTree()[0].expanded).toBeFalse();
    expect(service.targetTree()[0].expanded).toBeFalse();
  });

  it('should rename, type and nullable-update selected nodes and remove nodes safely', () => {
    seedSampleSchemas();
    const sourceNode = service.sourceLeafOptions().find((node) => node.displayPath == 'dadosCondutor.nome')!;
    const targetNode = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip')!;

    service.selectSourceNode(sourceNode.id);
    service.renameSourceNode('nomeCompleto');
    service.updateSourceNodeType('uuid');
    service.updateSourceNodeNullable(true);
    expect(service.selectedSourceNode()?.displayPath).toBe('dadosCondutor.nomeCompleto');
    expect(service.selectedSourceNode()?.type).toBe('uuid');
    expect(service.selectedSourceNode()?.nullable).toBeTrue();

    service.selectTargetNode(targetNode.id);
    service.renameTargetNode('tipoDocumento');
    service.updateTargetNodeType('string');
    service.updateTargetNodeNullable(true);
    expect(service.selectedTargetNode()?.displayPath).toBe('data.tipoDocumento');
    expect(service.selectedTargetNode()?.nullable).toBeTrue();

    service.removeSourceNode();
    expect(service.sourceLeafOptions().some((node) => node.id == sourceNode.id)).toBeFalse();

    service.removeTargetNode();
    expect(service.targetLeafOptions().some((node) => node.id == targetNode.id)).toBeFalse();

    service.selectSourceNode(service.sourceTree()[0].id);
    service.selectTargetNode(service.targetTree()[0].id);
    const sourceBefore = service.sourceTree().length;
    const targetBefore = service.targetTree().length;
    service.removeSourceNode();
    service.removeTargetNode();
    expect(service.sourceTree().length).toBe(sourceBefore);
    expect(service.targetTree().length).toBe(targetBefore);
  });

  it('should create nodes in source and target builders', () => {
    seedSampleSchemas();
    service.selectSourceNode(service.sourceTree()[0].id);
    service.selectTargetNode(service.targetTree()[0].id);

    service.addSourceNode('field');
    service.addTargetNode('object');

    expect(service.sourceTree()[0].children.some((node) => node.key.startsWith('novoCampo'))).toBeTrue();
    expect(service.targetTree()[0].children.some((node) => node.key.startsWith('novoObjeto'))).toBeTrue();
  });

  it('should manage rules with guided fields', () => {
    seedSampleSchemas();
    const initialCount = service.rules().length;

    service.createRule();
    const createdRule = service.rules()[service.rules().length - 1];
    expect(service.rules().length).toBe(initialCount + 1);

    service.updateRuleName(createdRule.id, 'Regra nova');
    service.updateRuleMatchMode(createdRule.id, 'any');
    service.addCondition(createdRule.id);
    service.addAction(createdRule.id);

    const refreshed = service.rules().find((rule) => rule.id == createdRule.id)!;
    expect(refreshed.name).toBe('Regra nova');
    expect(refreshed.matchMode).toBe('any');
    expect(refreshed.conditions.length).toBe(2);
    expect(refreshed.actions.length).toBe(2);
  });

  it('should generate output schema and validation errors from target tree', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao');
    service.selectTargetNode(target!.id);
    service.setSelectedAliasSource('$.dadosApolice.numeroApolice');

    const schema = service.generatedOutputSchema();
    const data = schema['properties'] as Record<string, unknown>;

    expect(data['data']).toEqual(jasmine.any(Object));
    expect(Array.isArray(service.validationErrors())).toBeTrue();
  });

  it('should apply the best suggestion to the selected target', () => {
    seedSampleSchemas();
    service.updateTargetJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              numeroApolice: { type: 'integer' }
            }
          }
        }
      })
    );
    service.importTargetSchema();

    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.numeroApolice');
    service.selectTargetNode(target!.id);
    service.applySuggestedMappingToSelectedTarget();

    const updated = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updated?.binding?.mode).toBe('alias');
    expect(updated?.binding?.sourcePaths).toEqual(['$.dadosApolice.numeroApolice']);
  });

  it('should auto-map empty targets with smart suggestions', () => {
    seedSampleSchemas();
    service.updateTargetJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              numeroApolice: { type: 'integer' },
              codigoSucursal: { type: 'integer' }
            }
          }
        }
      })
    );
    service.importTargetSchema();

    service.applySuggestedMappingsToEmptyTargets();

    const targetPaths = service.targetLeafOptions().reduce<Record<string, string[]>>((accumulator, node) => {
      accumulator[node.displayPath] = node.binding?.sourcePaths ?? [];
      return accumulator;
    }, {});

    expect(targetPaths['data.numeroApolice']).toEqual(['$.dadosApolice.numeroApolice']);
    expect(targetPaths['data.codigoSucursal']).toEqual(['$.dadosApolice.codigoSucursal']);
  });

  it('should navigate review queues for empty and error targets', () => {
    service.updateTargetJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              numeroApolice: { type: 'integer' },
              codigoSucursal: { type: 'integer' }
            }
          }
        }
      })
    );
    service.importTargetSchema();

    expect(service.reviewCounts().empty).toBe(2);
    expect(service.reviewCounts().error).toBe(2);

    service.navigateReviewQueue('empty', 1);
    const firstSelected = service.selectedTargetNode();
    expect(firstSelected?.displayPath).toBe('data.numeroApolice');

    service.navigateReviewQueue('empty', 1);
    expect(service.selectedTargetNode()?.displayPath).toBe('data.codigoSucursal');

    service.setSelectedAliasSource('$.dadosApolice.codigoSucursal');
    expect(service.reviewCounts().empty).toBe(1);

    service.navigateReviewQueue('error', 1);
    expect(service.selectedTargetNode()?.displayPath).toBe('data.numeroApolice');
  });

  it('should ignore review navigation when queue is empty', () => {
    seedSampleSchemas();
    const current = service.selectedTargetNodeId();

    service.navigateReviewQueue('rule', 1);

    expect(service.selectedTargetNodeId()).toBe(current);
  });

  it('should expose target review state sets for the tree', () => {
    service.updateTargetJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              numeroApolice: { type: 'integer' },
              codigoSucursal: { type: 'integer' }
            }
          }
        }
      })
    );
    service.importTargetSchema();

    const numero = service.targetLeafOptions().find((node) => node.displayPath == 'data.numeroApolice')!;
    const codigo = service.targetLeafOptions().find((node) => node.displayPath == 'data.codigoSucursal')!;

    service.selectTargetNode(codigo.id);
    service.createRuleTemplate('porto');

    expect(service.emptyTargetIds().has(numero.id)).toBeTrue();
    expect(service.ruleTargetIds().has(codigo.id)).toBeTrue();
    expect(service.errorTargetIds().has(numero.id)).toBeTrue();
    expect(service.selectedTargetHasVisualRule()).toBeTrue();
    expect(service.selectedTargetRuleCount()).toBeGreaterThan(0);
  });

  it('should replace and reorder concat sources from the selected target', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao');
    service.selectTargetNode(target!.id);
    service.setSelectedBindingMode('concat');
    service.addConcatSource('$.dadosApolice.codigoSucursal');
    service.addConcatSource('$.dadosApolice.numeroApolice');

    service.replaceConcatSource(1, '$.dadosApolice.numeroPropostaPrincipal');
    service.reorderConcatSource(1, 0);

    const updated = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updated?.binding?.sourcePaths).toEqual([
      '$.dadosApolice.numeroPropostaPrincipal',
      '$.dadosApolice.codigoSucursal'
    ]);
  });

  it('should support alias fallbacks and strategies', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao')!;
    service.selectTargetNode(target.id);
    service.setSelectedAliasSource('$.dadosApolice.codigoSucursal');
    service.addAliasFallback('$.dadosApolice.numeroApolice');
    service.updateSelectedAliasStrategy('first');

    expect(service.selectedTargetNode()?.binding?.sourcePaths).toEqual([
      '$.dadosApolice.codigoSucursal',
      '$.dadosApolice.numeroApolice'
    ]);
    expect(service.selectedTargetNode()?.binding?.aliasStrategy).toBe('first');

    service.replaceAliasFallback(1, '$.dadosApolice.numeroPropostaPrincipal');
    expect(service.selectedTargetNode()?.binding?.sourcePaths[1]).toBe('$.dadosApolice.numeroPropostaPrincipal');

    service.removeAliasFallback(1);
    expect(service.selectedTargetNode()?.binding?.sourcePaths).toEqual(['$.dadosApolice.codigoSucursal']);
  });

  it('should update concat separators, advanced expression and presets', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao')!;
    service.selectTargetNode(target.id);
    service.setSelectedBindingMode('concat');
    service.addConcatSource('$.dadosApolice.codigoSucursal');
    service.addConcatSource('$.dadosApolice.numeroApolice');

    service.updateConcatSeparator('-');
    service.applyConcatSeparatorPreset('|');
    service.updateSelectedAdvancedExpression("concat(src('$.a'), src('$.b'))");
    service.applyDefaultLiteralPreset('Porto');

    expect(service.selectedTargetNode()?.binding?.separator).toBe('|');
    expect(service.selectedTargetNode()?.binding?.advancedExpression).toContain("src('$.a')");
    expect(service.selectedTargetNode()?.binding?.defaultValue).toBe('Porto');
  });

  it('should ignore concat replacement and reorder when indexes are invalid', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao')!;
    service.selectTargetNode(target.id);
    service.setSelectedBindingMode('concat');
    service.addConcatSource('$.dadosApolice.codigoSucursal');
    service.addConcatSource('$.dadosApolice.numeroApolice');
    const before = [...(service.selectedTargetNode()?.binding?.sourcePaths ?? [])];

    service.replaceConcatSource(5, '$.dadosApolice.numeroItem');
    service.reorderConcatSource(5, 0);
    service.moveConcatSource(0, -1);

    expect(service.selectedTargetNode()?.binding?.sourcePaths).toEqual(before);
  });

  it('should keep concat formatting optional until explicitly configured', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.idMediacao');
    service.selectTargetNode(target!.id);
    service.setSelectedBindingMode('concat');
    service.addConcatSource('$.dadosApolice.codigoSucursal');
    service.addConcatSource('$.dadosApolice.numeroApolice');

    let updated = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updated?.binding?.formatters.length).toBe(0);

    service.updateConcatFormat(1, { length: 3, char: '0', pad: 'left' });
    updated = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updated?.binding?.formatters[1]?.length).toBe(3);

    service.clearConcatFormat(1);
    updated = service.targetLeafOptions().find((node) => node.id == target!.id);
    expect(updated?.binding?.formatters[1]?.length).toBe(0);
  });

  it('should build default script drafts when updating script pieces from a clean field', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip')!;
    service.selectTargetNode(target.id);

    service.updateSelectedScriptLanguage('javascript');
    expect(service.selectedTargetNode()?.binding?.script).toEqual(
      jasmine.objectContaining({
        language: 'javascript',
        source: '',
        returnType: 'string'
      })
    );

    service.clearSelectedBinding();
    service.updateSelectedScriptSource('return 10;');
    expect(service.selectedTargetNode()?.binding?.script).toEqual(
      jasmine.objectContaining({
        language: 'java',
        source: 'return 10;',
        returnType: 'string'
      })
    );

    service.clearSelectedBinding();
    service.updateSelectedScriptReturnType('number');
    expect(service.selectedTargetNode()?.binding?.script).toEqual(
      jasmine.objectContaining({
        language: 'java',
        source: '',
        returnType: 'number'
      })
    );
  });

  it('should create guided rule templates for the selected target', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip');
    service.selectTargetNode(target!.id);

    service.createRuleTemplate('porto');
    service.createRuleTemplate('apolice');
    service.createRuleTemplate('cnpjProdutor');

    const recentRules = service.rules().slice(-3);
    expect(recentRules.map((rule) => rule.name)).toEqual([
      'Ramo e marca definem Porto',
      'Numero de apolice habilita tipo',
      'Produtor padrao'
    ]);
    expect(recentRules.every((rule) => rule.actions[0].fieldPath == '$.data.tip')).toBeTrue();
  });

  it('should materialize visual rules as eval in the generated schema', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip');
    service.selectTargetNode(target!.id);
    service.createRuleTemplate('porto');

    const schema = service.generatedOutputSchema();
    const data = (((schema['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const evalBlock = tip['eval'] as Record<string, unknown>;

    expect(evalBlock['alias']).toContain('"Porto"');
    expect(evalBlock['alias']).toContain('dadosApolice.codigoMarca == 1001');
  });

  it('should include visual rules in the persisted schema_destino and synced technical json', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip');
    service.selectTargetNode(target!.id);
    service.createRuleTemplate('porto');

    const document = service.persistenceDocument();
    const data = (((document.schema_destino['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const evalBlock = tip['eval'] as Record<string, unknown>;

    expect(evalBlock['alias']).toContain('"Porto"');
    expect(evalBlock['alias']).toContain('dadosApolice.codigoMarca == 1001');
    expect(service.targetJsonText()).toContain('"eval"');
    expect(service.targetJsonText()).toContain('Porto');
  });

  it('should save only the persisted mapper document', () => {
    seedSampleSchemas();
    service.updatePersistenceMetadata({
      nomeParceiro: 'porto_custom',
      eventoParceiro: 'renovacao',
      tipoSchema: 'destino',
      versaoSchema: 'v2',
      schemaStorageField: 'schema_destino'
    });

    service.saveConfig();

    const request = httpMock.expectOne('http://localhost:8080/api/configs');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.nome_parceiro).toBe('porto_custom');
    expect(request.request.body.evento_parceiro).toBe('renovacao');
    expect(request.request.body.tipo_schema).toBe('destino');
    expect(request.request.body.versao_schema).toBe('v2');
    expect(request.request.body.schema_origem).toEqual(jasmine.any(Object));
    expect(request.request.body.schema_destino).toEqual(jasmine.any(Object));
    expect(request.request.body.persistenceDocument).toBeUndefined();
    expect(request.request.body.editorDraft).toBeUndefined();
    request.flush({
      id: '1',
      ...request.request.body
    });

    expect(service.lastSavedResponse()?.id).toBe('1');
    expect(service.saveStatus()).toContain('Configuracao salva com sucesso');
  });

  it('should send visual rules compiled into schema_destino when saving', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip');
    service.selectTargetNode(target!.id);
    service.createRuleTemplate('porto');

    service.saveConfig();

    const request = httpMock.expectOne('http://localhost:8080/api/configs');
    const data = ((((request.request.body.schema_destino as Record<string, unknown>)['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;
    const tip = data['tip'] as Record<string, unknown>;
    const evalBlock = tip['eval'] as Record<string, unknown>;

    expect(evalBlock['alias']).toContain('"Porto"');
    expect(evalBlock['alias']).toContain('dadosApolice.codigoMarca == 1001');
    request.flush({
      id: 'save-rule-1',
      ...request.request.body
    });
  });

  it('should expose save error when backend save fails', () => {
    seedSampleSchemas();

    service.saveConfig();

    const request = httpMock.expectOne('http://localhost:8080/api/configs');
    request.flush({ message: 'falhou' }, { status: 500, statusText: 'Server Error' });

    expect(service.saveError()).toBe('falhou');
    expect(service.isSaving()).toBeFalse();
    expect(service.saveStatus()).toBe('');
  });

  it('should fallback to generic save and load error messages when backend has no message', () => {
    seedSampleSchemas();

    service.saveConfig();
    const saveRequest = httpMock.expectOne('http://localhost:8080/api/configs');
    saveRequest.flush({}, { status: 500, statusText: 'Server Error' });
    expect(service.saveError()).toBe('Nao foi possivel salvar na API.');

    service.loadLatestConfig();
    const loadRequest = httpMock.expectOne((req) => req.method == 'GET' && req.url == 'http://localhost:8080/api/configs/latest');
    loadRequest.flush({}, { status: 500, statusText: 'Server Error' });
    expect(service.saveError()).toBe('Nao foi possivel carregar a ultima configuracao.');
  });

  it('should migrate v1 config payloads on load', () => {
    service.loadLatestConfig();

    const request = httpMock.expectOne((req) =>
      req.method == 'GET' &&
      req.url == 'http://localhost:8080/api/configs/latest' &&
      req.params.get('nome_parceiro') == 'porto_teste_1' &&
      req.params.get('evento_parceiro') == 'emissao' &&
      req.params.get('tipo_schema') == 'destino' &&
      req.params.get('versao_schema') == 'v1'
    );
    request.flush({
      id: '2',
      fileName: 'legacy.json',
      savedAt: '2026-03-21T00:00:00Z',
      config: {
        sourceJsonText: JSON.stringify({
          type: 'object',
          properties: {
            dadosApolice: {
              type: 'object',
              properties: {
                numeroApolice: { type: 'integer' }
              }
            }
          }
        }),
        targetJsonText: JSON.stringify({
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                contrato: {
                  type: 'object',
                  properties: {
                    numero: { type: 'string' }
                  }
                }
              }
            }
          }
        }),
        sourceSchema: [],
        targetSchema: [],
        mappings: [
          {
            id: 'legacy-map',
            sourceFieldId: 'source:$.dadosApolice.numeroApolice',
            targetFieldId: 'target:$.data.contrato.numero',
            sourcePath: '$.dadosApolice.numeroApolice',
            targetPath: '$.data.contrato.numero',
            alias: 'numero',
            xPath: '/data/contrato/numero',
            transformExpression: ''
          }
        ],
        rules: []
      }
    });

    expect(service.targetLeafOptions().some((node) => node.binding?.sourcePaths.includes('$.dadosApolice.numeroApolice'))).toBeTrue();
    expect(service.saveStatus()).toContain('Ultima configuracao carregada');
  });

  it('should restore persistence metadata from v2 config payloads on load', () => {
    service.loadLatestConfig();

    const request = httpMock.expectOne((req) =>
      req.method == 'GET' &&
      req.url == 'http://localhost:8080/api/configs/latest' &&
      req.params.get('nome_parceiro') == 'porto_teste_1' &&
      req.params.get('evento_parceiro') == 'emissao' &&
      req.params.get('tipo_schema') == 'destino' &&
      req.params.get('versao_schema') == 'v1'
    );
    request.flush({
      id: '3',
      fileName: 'v2.json',
      savedAt: '2026-03-21T00:00:00Z',
      config: {
        version: 'v2',
        sourceJsonText: service.sourceJsonText(),
        targetJsonText: service.targetJsonText(),
        sourceSchema: [],
        targetSchema: [],
        mappings: [],
        rules: [],
        sourceSchemaRaw: service.sourceJsonText(),
        targetSchemaRaw: service.targetJsonText(),
        editorDraft: service.editorDocument(),
        generatedOutputSchema: service.generatedOutputSchema(),
        persistenceMetadata: {
          nomeParceiro: 'parceiro_v2',
          eventoParceiro: 'sinistro',
          tipoSchema: 'destino',
          versaoSchema: 'v9',
          schemaStorageField: 'schema_destino'
        },
        persistenceDocument: {
          nome_parceiro: 'parceiro_v2',
          tipo_schema: 'destino',
          versao_schema: 'v9',
          evento_parceiro: 'sinistro',
          schema_origem: service.generatedSourceSchema(),
          schema_destino: service.generatedOutputSchema()
        },
        validationErrors: [],
        metadata: {
          schemaVersion: 2,
          generatedAt: '2026-03-21T00:00:00Z'
        }
      }
    });

    expect(service.persistenceMetadata().nomeParceiro).toBe('parceiro_v2');
    expect(service.persistenceMetadata().eventoParceiro).toBe('sinistro');
    expect(service.persistenceMetadata().versaoSchema).toBe('v9');
  });

  it('should load v2 configs even when ids, rules and schema URIs are missing', () => {
    seedSampleSchemas();
    service.loadLatestConfig();

    const request = httpMock.expectOne((req) => req.method == 'GET' && req.url == 'http://localhost:8080/api/configs/latest');
    request.flush({
      fileName: 'v2-min.json',
      savedAt: '2026-03-21T00:00:00Z',
      config: {
        version: 'v2',
        sourceJsonText: JSON.stringify({ type: 'object', properties: {} }),
        targetJsonText: JSON.stringify({ type: 'object', properties: {} }),
        sourceSchema: [],
        targetSchema: [],
        mappings: [],
        sourceSchemaRaw: JSON.stringify({ type: 'object', properties: {} }),
        targetSchemaRaw: JSON.stringify({ type: 'object', properties: {} }),
        editorDraft: {
          version: 'v2',
          sourceTree: service['schemaImport'].createEmptyTree('source'),
          targetTree: service['schemaImport'].createEmptyTree('target'),
          selectedSourceNodeId: '',
          selectedTargetNodeId: ''
        },
        generatedOutputSchema: {},
        persistenceMetadata: {
          nomeParceiro: 'sem-uri',
          eventoParceiro: 'evt',
          tipoSchema: 'destino',
          versaoSchema: 'v3',
          schemaStorageField: 'schema_destino'
        },
        persistenceDocument: {
          nome_parceiro: 'sem-uri',
          tipo_schema: 'destino',
          versao_schema: 'v3',
          evento_parceiro: 'evt',
          schema_origem: {},
          schema_destino: {}
        },
        validationErrors: [],
        metadata: {
          schemaVersion: 2,
          generatedAt: '2026-03-21T00:00:00Z'
        }
      }
    });

    expect(service.selectedSourceNodeId()).toBe('source-root');
    expect(service.selectedTargetNodeId()).toBe('target-root');
    expect(service.rules()).toEqual([]);
  });

  it('should load flat persisted documents returned by the backend', () => {
    service.loadLatestConfig();

    const request = httpMock.expectOne((req) =>
      req.method == 'GET' &&
      req.url == 'http://localhost:8080/api/configs/latest'
    );
    request.flush({
      id: 'flat-1',
      nome_parceiro: 'parceiro_flat',
      evento_parceiro: 'emissao',
      tipo_schema: 'destino',
      versao_schema: 'v7',
      schema_origem: {
        type: 'object',
        properties: {
          dadosApolice: {
            type: 'object',
            properties: {
              numeroApolice: { type: 'integer' }
            }
          }
        }
      },
      schema_destino: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              contrato: {
                type: 'object',
                properties: {
                  numero: { type: 'string' }
                }
              }
            }
          }
        }
      }
    });

    expect(service.persistenceMetadata().nomeParceiro).toBe('parceiro_flat');
    expect(service.persistenceMetadata().versaoSchema).toBe('v7');
    expect(service.sourceLeafOptions().some((node) => node.displayPath == 'dadosApolice.numeroApolice')).toBeTrue();
    expect(service.targetLeafOptions().some((node) => node.displayPath == 'data.contrato.numero')).toBeTrue();
  });

  it('should load flat persisted documents with invalid schema payloads as empty objects', () => {
    service.loadLatestConfig();

    const request = httpMock.expectOne((req) => req.method == 'GET' && req.url == 'http://localhost:8080/api/configs/latest');
    request.flush({
      id: 'flat-2',
      nome_parceiro: 'parceiro_flat',
      evento_parceiro: 'emissao',
      tipo_schema: 'destino',
      versao_schema: 'v7',
      schema_origem: null,
      schema_destino: ['invalido']
    });

    expect(service.sourceTree()[0].displayPath).toBe('origem');
    expect(service.targetTree()[0].displayPath).toBe('destino');
    expect(service.sourceJsonText()).toBe('{}');
    expect(service.targetJsonText()).toBe('{}');
  });

  it('should expose load error when backend latest fails', () => {
    service.loadLatestConfig();

    const request = httpMock.expectOne((req) => req.method == 'GET' && req.url == 'http://localhost:8080/api/configs/latest');
    request.flush({ message: 'indisponivel' }, { status: 500, statusText: 'Server Error' });

    expect(service.saveError()).toBe('indisponivel');
    expect(service.isLoadingLatest()).toBeFalse();
    expect(service.saveStatus()).toBe('');
  });

  it('should persist the current raw source and target schemas from the technical editors', () => {
    seedSampleSchemas();

    const document = service.persistenceDocument();
    const targetProperties = (((document.schema_destino['properties'] as Record<string, unknown>)['data'] as Record<string, unknown>)['properties']) as Record<string, unknown>;

    expect(document.schema_origem['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(document.schema_destino['$schema']).toBe('http://json-schema.org/draft-04/schema#');
    expect(targetProperties['contrato']).toEqual(jasmine.any(Object));
  });

  it('should fallback to generated schemas when technical json is invalid', () => {
    seedSampleSchemas();
    service.updateSourceJsonText('{ invalid');
    service.updateTargetJsonText('{ invalid');

    const document = service.persistenceDocument();

    expect(document.schema_origem['type']).toBe('object');
    expect(document.schema_destino['type']).toBe('object');
  });

  it('should create rules with root fallback paths when trees are empty', () => {
    service.updateSourceJsonText('');
    service.updateTargetJsonText('');
    service.importSourceSchema();
    service.importTargetSchema();

    service.createRule();
    const rule = service.rules()[0];

    expect(rule.conditions[0].fieldPath).toBe('$');
    expect(rule.actions[0].fieldPath).toBe('$');
    expect(rule.actions[0].sourceFieldPath).toBe('$');
  });

  it('should update and remove specific conditions, actions and rules', () => {
    seedSampleSchemas();
    service.createRule();
    const createdRule = service.rules()[0];
    const condition = createdRule.conditions[0];
    const action = createdRule.actions[0];

    service.updateCondition(createdRule.id, condition.id, { operator: 'exists', value: 'x' });
    service.updateAction(createdRule.id, action.id, { type: 'setExpression', expression: 'a + b' });
    expect(service.rules()[0].conditions[0]).toEqual(jasmine.objectContaining({ operator: 'exists', value: 'x' }));
    expect(service.rules()[0].actions[0]).toEqual(jasmine.objectContaining({ type: 'setExpression', expression: 'a + b' }));

    service.removeCondition(createdRule.id, condition.id);
    service.removeAction(createdRule.id, action.id);
    expect(service.rules()[0].conditions.length).toBe(0);
    expect(service.rules()[0].actions.length).toBe(0);

    service.removeRule(createdRule.id);
    expect(service.rules().length).toBe(0);
  });

  it('should save and load with fallback messages when the backend omits ids or messages', () => {
    seedSampleSchemas();

    service.saveConfig();
    let request = httpMock.expectOne('http://localhost:8080/api/configs');
    request.flush({
      ...service.persistenceDocument()
    });

    expect(service.saveStatus()).toBe('Configuracao salva com sucesso.');
    expect(service.isSaving()).toBeFalse();

    service.loadLatestConfig();
    request = httpMock.expectOne((req) => req.url == 'http://localhost:8080/api/configs/latest');
    request.flush({
      ...service.persistenceDocument()
    });

    expect(service.saveStatus()).toBe('Ultima configuracao carregada.');
    expect(service.isLoadingLatest()).toBeFalse();
  });

  it('should expose fallback save and load errors when backend response has no message', () => {
    service.saveConfig();
    let request = httpMock.expectOne('http://localhost:8080/api/configs');
    request.flush({}, { status: 500, statusText: 'Server error' });

    expect(service.saveError()).toBe('Nao foi possivel salvar na API.');
    expect(service.isSaving()).toBeFalse();

    service.loadLatestConfig();
    request = httpMock.expectOne((req) => req.url == 'http://localhost:8080/api/configs/latest');
    request.flush({}, { status: 500, statusText: 'Server error' });

    expect(service.saveError()).toBe('Nao foi possivel carregar a ultima configuracao.');
    expect(service.isLoadingLatest()).toBeFalse();
  });

  it('should apply legacy configs using alias-path target matching and normalize rule match mode', () => {
    service.loadLatestConfig();
    const request = httpMock.expectOne((req) => req.url == 'http://localhost:8080/api/configs/latest');
    request.flush({
      id: 'legacy-1',
      config: {
        sourceJsonText: JSON.stringify({
          type: 'object',
          properties: {
            dadosApolice: {
              type: 'object',
              properties: {
                numeroApolice: { type: 'integer' }
              }
            }
          }
        }),
        targetJsonText: JSON.stringify({
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                proposta: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' }
                  }
                }
              }
            }
          }
        }),
        sourceSchema: [],
        targetSchema: [],
        mappings: [
          {
            id: 'map-1',
            sourceFieldId: 'source:$.dadosApolice.numeroApolice',
            targetFieldId: 'target:$.data.proposta.id',
            sourcePath: '$.dadosApolice.numeroApolice',
            targetPath: 'data.proposta.id',
            alias: 'id',
            xPath: '/data/proposta/id',
            transformExpression: 'expr'
          }
        ],
        rules: [
          {
            id: 'rule-legacy',
            name: 'legacy',
            conditions: [],
            actions: []
          }
        ]
      }
    });

    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.proposta.id');
    expect(target?.binding?.sourcePaths).toEqual(['$.dadosApolice.numeroApolice']);
    expect(target?.binding?.advancedExpression).toBe('expr');
    expect(service.rules()[0].matchMode).toBe('all');
  });

  it('should no-op selected binding helpers when no field is selected and cover fallback helpers on empty trees', () => {
    service.selectTargetNode(service.targetTree()[0].id);
    const before = JSON.stringify(service.targetTree());

    service.setSelectedAliasSource('$.dadosApolice.uf');
    service.setSelectedDefaultLiteral('x');
    service.setSelectedDefaultSource('$.dadosApolice.uf');
    service.updateSelectedEvalExpression('1 + 1');
    service.updateSelectedScriptLanguage('javascript');
    service.updateSelectedScriptSource('return 1;');
    service.updateSelectedScriptReturnType('number');
    service.addAliasFallback('$.dadosApolice.uf');
    service.removeAliasFallback(0);
    service.replaceAliasFallback(0, '$.x');
    service.addConcatSource('$.x');
    service.removeConcatSource(0);
    service.replaceConcatSource(0, '$.x');
    service.moveConcatSource(0, 1);
    service.reorderConcatSource(0, 2);
    service.updateConcatSeparator('-');
    service.applyConcatSeparatorPreset('/');
    service.updateConcatFormat(0, { pad: 'right' });
    service.clearConcatFormat(0);
    service.updateSelectedAdvancedExpression('a');

    expect(JSON.stringify(service.targetTree())).toBe(before);

    service.createRuleTemplate('porto');
    const rule = service.rules()[0];
    expect(rule.actions[0].fieldPath).toBe('$');
  });

  it('should manage alias and concat helpers including fallback branches', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip')!;
    service.selectTargetNode(target.id);

    service.setSelectedAliasSource('$.dadosApolice.codigoSucursal');
    service.addAliasFallback('$.dadosApolice.ramo');
    service.replaceAliasFallback(1, '$.dadosApolice.numeroItem');
    expect(service.selectedTargetNode()?.binding?.sourcePaths).toEqual([
      '$.dadosApolice.codigoSucursal',
      '$.dadosApolice.numeroItem'
    ]);

    service.removeAliasFallback(1);
    service.removeAliasFallback(0);
    expect(service.selectedTargetNode()?.binding?.mode).toBe('unmapped');

    service.addConcatSource('$.dadosApolice.codigoSucursal');
    service.addConcatSource('$.dadosApolice.ramo');
    service.updateConcatFormat(0, { pad: 'right', length: 3, char: 'x' });
    service.clearConcatFormat(1);
    service.moveConcatSource(1, -1);
    service.reorderConcatSource(0, 10);
    service.replaceConcatSource(1, '$.dadosApolice.numeroItem');
    service.removeConcatSource(0);

    expect(service.selectedTargetNode()?.binding?.mode).toBe('alias');
    expect(service.selectedTargetNode()?.binding?.sourcePaths).toEqual(['$.dadosApolice.numeroItem']);
  });

  it('should keep rule collections unchanged when ids do not match', () => {
    seedSampleSchemas();
    service.createRule();
    const snapshot = JSON.stringify(service.rules());

    service.updateRuleName('missing', 'x');
    service.updateRuleMatchMode('missing', 'any');
    service.addCondition('missing');
    service.updateCondition('missing', 'missing', { value: '1' });
    service.removeCondition('missing', 'missing');
    service.addAction('missing');
    service.updateAction('missing', 'missing', { value: '1' });
    service.removeAction('missing', 'missing');

    expect(JSON.stringify(service.rules())).toBe(snapshot);
  });

  it('should create script bindings with fallback defaults and preserve schema uris from persisted documents', () => {
    seedSampleSchemas();
    const target = service.targetLeafOptions().find((node) => node.displayPath == 'data.tip')!;
    service.selectTargetNode(target.id);

    service.updateSelectedScriptLanguage('javascript');
    service.updateSelectedScriptSource('return 2;');
    service.updateSelectedScriptReturnType('number');
    expect(service.selectedTargetNode()?.binding?.script).toEqual(
      jasmine.objectContaining({
        language: 'javascript',
        source: 'return 2;',
        returnType: 'number'
      })
    );

    service.loadLatestConfig();
    const request = httpMock.expectOne((req) => req.url == 'http://localhost:8080/api/configs/latest');
    request.flush({
      nome_parceiro: 'porto',
      tipo_schema: 'destino',
      versao_schema: 'v2',
      evento_parceiro: 'endosso',
      schema_origem: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {}
      },
      schema_destino: {
        $schema: 'http://json-schema.org/draft-04/schema#',
        type: 'object',
        properties: {}
      }
    });

    expect(service.sourceSchemaUri()).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(service.targetSchemaUri()).toBe('http://json-schema.org/draft-04/schema#');
  });
});
