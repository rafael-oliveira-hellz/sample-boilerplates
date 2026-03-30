import { describe, expect, it } from 'vitest';
import { createEmptyTree } from './schemaImport';
import { addNode, bindSourceDrop, removeNode, renameNode, resolveDroppedSourcePath, setAllExpanded, updateNodeNullable, updateNodeType } from './editorTreeState';

describe('editorTreeState', () => {
  it('adiciona, renomeia, altera tipo e nullable de um nó manual', () => {
    const sourceTree = createEmptyTree('source');
    const added = addNode(sourceTree, 'source', 'source-root', 'field');
    const renamed = renameNode(added.tree, added.createdNodeId, 'codigoMarca');
    const typed = updateNodeType(renamed, added.createdNodeId, 'integer');
    const nullable = updateNodeNullable(typed, added.createdNodeId, true);

    const field = nullable[0].children[0];
    expect(field.key).toBe('codigoMarca');
    expect(field.path).toBe('$.codigoMarca');
    expect(field.type).toBe('integer');
    expect(field.nullable).toBe(true);
  });

  it('expande e recolhe a árvore inteira', () => {
    const targetTree = addNode(createEmptyTree('target'), 'target', 'target-root', 'object').tree;
    const expanded = setAllExpanded(targetTree, true);
    const collapsed = setAllExpanded(expanded, false);

    expect(expanded[0].expanded).toBe(true);
    expect(collapsed[0].expanded).toBe(false);
    expect(collapsed[0].children[0].expanded).toBe(false);
  });

  it('remove o nó selecionado e volta a seleção para o root do escopo', () => {
    const targetTree = addNode(createEmptyTree('target'), 'target', 'target-root', 'field');
    const removed = removeNode(targetTree.tree, targetTree.createdNodeId);

    expect(removed.tree[0].children).toHaveLength(0);
    expect(removed.nextSelectedNodeId).toBe('target-root');
  });

  it('faz drop da origem no destino criando ou complementando binding', () => {
    const targetWithContainer = addNode(createEmptyTree('target'), 'target', 'target-root', 'object');
    const firstDrop = bindSourceDrop(targetWithContainer.tree, targetWithContainer.createdNodeId, '$.dadosApolice.codigoMarca');
    const createdField = firstDrop.tree[0].children[0].children[0];

    expect(createdField.key).toBe('codigoMarca');
    expect(createdField.binding?.mode).toBe('alias');
    expect(createdField.binding?.sourcePaths).toEqual(['$.dadosApolice.codigoMarca']);

    const secondDrop = bindSourceDrop(firstDrop.tree, createdField.id, '$.dadosApolice.numeroApolice');
    const updatedField = secondDrop.tree[0].children[0].children[0];

    expect(updatedField.binding?.mode).toBe('concat');
    expect(updatedField.binding?.sourcePaths).toEqual(['$.dadosApolice.codigoMarca', '$.dadosApolice.numeroApolice']);
  });

  it('faz drop em array criando o campo dentro do item-modelo', () => {
    const targetWithArray = addNode(createEmptyTree('target'), 'target', 'target-root', 'array');
    const renamedArray = renameNode(targetWithArray.tree, targetWithArray.createdNodeId, 'itens');
    const dropped = bindSourceDrop(renamedArray, targetWithArray.createdNodeId, '$.dadosApolice.codigoMarca');

    const itemModel = dropped.tree[0].children[0].children[0];
    const createdField = itemModel.children[0];

    expect(itemModel.itemModel).toBe(true);
    expect(createdField.key).toBe('codigoMarca');
    expect(createdField.path).toBe('$.itens[0].codigoMarca');
    expect(createdField.binding?.sourcePaths).toEqual(['$.dadosApolice.codigoMarca']);
  });

  it('relativiza o alias quando o drop acontece dentro de um array com map_from', () => {
    const targetWithArray = addNode(createEmptyTree('target'), 'target', 'target-root', 'array');
    const renamedArray = renameNode(targetWithArray.tree, targetWithArray.createdNodeId, 'itensDestino');
    renamedArray[0].children[0].mapFrom = { sourcePaths: ['$.itens'] };

    const dropped = bindSourceDrop(renamedArray, targetWithArray.createdNodeId, '$.itens[0].codigoMarca');

    const createdField = dropped.tree[0].children[0].children[0].children[0];

    expect(createdField.key).toBe('codigoMarca');
    expect(createdField.path).toBe('$.itensDestino[0].codigoMarca');
    expect(createdField.binding?.sourcePaths).toEqual(['$.codigoMarca']);
  });

  it('preserva o contexto relativo do array interno quando ha map_from em cascata', () => {
    const root = createEmptyTree('target');
    const pacotes = addNode(root, 'target', 'target-root', 'array');
    const renamedPacotes = renameNode(pacotes.tree, pacotes.createdNodeId, 'pacotesDestino');
    renamedPacotes[0].children[0].mapFrom = { sourcePaths: ['$.pacotes'] };

    const pacoteItemId = `${pacotes.createdNodeId}.item`;
    const itens = addNode(renamedPacotes, 'target', pacoteItemId, 'array');
    const renamedItens = renameNode(itens.tree, itens.createdNodeId, 'itens');
    const itensNode = renamedItens[0].children[0].children[0];
    itensNode.mapFrom = { sourcePaths: ['$.itens'] };

    const itemModel = itensNode.children[0];
    const resolved = resolveDroppedSourcePath(renamedItens, itemModel, '$.pacotes[0].itens[0].codigoMarca');

    expect(resolved).toBe('$.itens[0].codigoMarca');
  });
});
