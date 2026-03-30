import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { SchemaNodeDraft } from '../../core/models/mapperModels';
import { WorkbenchPanel } from './WorkbenchPanel';

function createField(id: string, displayPath: string, mode: 'unmapped' | 'alias' | 'concat' | 'eval' = 'unmapped'): SchemaNodeDraft {
  return {
    id,
    scope: 'target',
    key: displayPath.split('.').at(-1) ?? displayPath,
    label: displayPath.split('.').at(-1) ?? displayPath,
    path: `$.${displayPath}`,
    aliasPath: displayPath,
    displayPath,
    kind: 'field',
    type: 'string',
    parentId: 'target-root',
    children: [],
    expanded: true,
    manual: true,
    itemModel: false,
    binding: {
      mode,
      sourcePaths: mode === 'concat' ? ['$.origem.a', '$.origem.b'] : mode === 'alias' ? ['$.origem.a'] : [],
      aliasStrategy: 'fallback',
      separator: mode === 'concat' ? '-' : '',
      formatters: [],
      defaultValue: '',
      defaultSourcePath: '',
      advancedExpression: '',
      evalExpression: mode === 'eval' ? 'origem.a ? "ok" : null' : '',
      script: {
        language: 'java',
        source: '',
        returnType: 'string'
      }
    }
  };
}

describe('WorkbenchPanel', () => {
  it('mostra buckets de revisão e permite selecionar um item pelo bucket', () => {
    const onSelectTarget = vi.fn();
    const emptyField = createField('empty-field', 'data.vazio');
    const concatField = createField('concat-field', 'data.concat', 'concat');
    const ruleField = createField('rule-field', 'data.regra', 'eval');

    render(
      <WorkbenchPanel
        sourceFieldOptions={[]}
        sourceNodeOptions={[]}
        targetTree={[
          {
            id: 'target-root',
            scope: 'target',
            key: 'root',
            label: 'Destino',
            path: '$',
            aliasPath: '',
            displayPath: 'destino',
            kind: 'root',
            type: 'object',
            parentId: null,
            children: [emptyField, concatField, ruleField],
            expanded: true,
            manual: false,
            itemModel: false
          }
        ]}
        selectedTargetNode={concatField}
        mappedCount={2}
        reviewCounts={{ empty: 1, rule: 1, error: 1 }}
        reviewTargetIds={{ empty: ['empty-field'], rule: ['rule-field'], error: ['concat-field'] }}
        ruleCount={1}
        validationErrors={[]}
        highlightedConcatSegmentIndex={null}
        draggedSourcePath=""
        onSelectTarget={onSelectTarget}
        onSetBindingMode={vi.fn()}
        onSetAliasSource={vi.fn()}
        onAddAliasFallback={vi.fn()}
        onReplaceAliasFallback={vi.fn()}
        onRemoveAliasFallback={vi.fn()}
        onUpdateAliasStrategy={vi.fn()}
        onAddConcatSource={vi.fn()}
        onRemoveConcatSource={vi.fn()}
        onMoveConcatSource={vi.fn()}
        onUpdateConcatSeparator={vi.fn()}
        onUpdateConcatFormat={vi.fn()}
        onClearConcatFormat={vi.fn()}
        onSetDefaultLiteral={vi.fn()}
        onSetDefaultSource={vi.fn()}
        onSetEvalExpression={vi.fn()}
        onSetAdvancedExpression={vi.fn()}
        onSetScript={vi.fn()}
        onSetMapFromSource={vi.fn()}
        onApplySuggestedMapping={vi.fn()}
        onApplySuggestedMappingsBatch={vi.fn()}
        onHoverConcatSegment={vi.fn()}
      />
    );

    expect(screen.getByText('Revisar campos vazios')).toBeInTheDocument();
    expect(screen.getByText('Campos com eval ou script')).toBeInTheDocument();
    expect(screen.getByText('Campos com alerta')).toBeInTheDocument();
    expect(screen.getByText('fan-in 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /data\.vazio/i }));
    expect(onSelectTarget).toHaveBeenCalledWith('empty-field');
  });
  it('aplica a ligação manual visual pela lane de fallback', () => {
    const onAddAliasFallback = vi.fn();
    const selectedField = createField('alias-field', 'data.alias', 'alias');

    render(
      <WorkbenchPanel
        sourceFieldOptions={[
          {
            id: 'source-codigo',
            scope: 'source',
            key: 'codigoMarca',
            label: 'codigoMarca',
            path: '$.dadosApolice.codigoMarca',
            aliasPath: 'dadosApolice.codigoMarca',
            displayPath: 'dadosApolice.codigoMarca',
            kind: 'field',
            type: 'integer',
            parentId: 'source-root',
            children: [],
            expanded: true,
            manual: false,
            itemModel: false
          }
        ]}
        sourceNodeOptions={[]}
        targetTree={[]}
        selectedTargetNode={selectedField}
        mappedCount={1}
        reviewCounts={{ empty: 0, rule: 0, error: 0 }}
        reviewTargetIds={{ empty: [], rule: [], error: [] }}
        ruleCount={0}
        validationErrors={[]}
        highlightedConcatSegmentIndex={null}
        draggedSourcePath="$.dadosApolice.codigoMarca"
        onSelectTarget={vi.fn()}
        onSetBindingMode={vi.fn()}
        onSetAliasSource={vi.fn()}
        onAddAliasFallback={onAddAliasFallback}
        onReplaceAliasFallback={vi.fn()}
        onRemoveAliasFallback={vi.fn()}
        onUpdateAliasStrategy={vi.fn()}
        onAddConcatSource={vi.fn()}
        onRemoveConcatSource={vi.fn()}
        onMoveConcatSource={vi.fn()}
        onUpdateConcatSeparator={vi.fn()}
        onUpdateConcatFormat={vi.fn()}
        onClearConcatFormat={vi.fn()}
        onSetDefaultLiteral={vi.fn()}
        onSetDefaultSource={vi.fn()}
        onSetEvalExpression={vi.fn()}
        onSetAdvancedExpression={vi.fn()}
        onSetScript={vi.fn()}
        onSetMapFromSource={vi.fn()}
        onApplySuggestedMapping={vi.fn()}
        onApplySuggestedMappingsBatch={vi.fn()}
        onHoverConcatSegment={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir assistentes' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Fallback/i })[0]);

    expect(onAddAliasFallback).toHaveBeenCalledWith('alias-field', '$.dadosApolice.codigoMarca');
  });
});
