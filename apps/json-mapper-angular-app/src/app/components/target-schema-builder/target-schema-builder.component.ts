import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SchemaTechnicalPanelComponent } from '@app/components/schema-technical-panel/schema-technical-panel.component';
import { UI_TEXTS } from '../../content/ui-texts';
import { PROGRAMMING_TYPE_OPTION_GROUPS, SchemaNodeDraft } from '@models/mapper.models';

export interface ImportedFileSummary {
  name: string;
  mimeType: string;
  extension: string;
  sizeLabel: string;
}

@Component({
  selector: 'app-target-schema-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, SchemaTechnicalPanelComponent],
  templateUrl: './target-schema-builder.component.html',
  styleUrl: './target-schema-builder.component.scss'
})
export class TargetSchemaBuilderComponent {
  @Input({ required: true }) rawJsonText = '';
  @Input() targetError = '';
  @Input({ required: true }) nodes: SchemaNodeDraft[] = [];
  @Input() selectedNodeId = '';
  @Input() mappedTargetIds = new Set<string>();
  @Input() emptyTargetIds = new Set<string>();
  @Input() ruleTargetIds = new Set<string>();
  @Input() errorTargetIds = new Set<string>();
  @Input() draggedSourcePath = '';
  @Input() highlightedConcatPortIndex: number | null = null;

  @Output() rawJsonTextChange = new EventEmitter<string>();
  @Output() importSchema = new EventEmitter<void>();
  @Output() importSchemaText = new EventEmitter<string>();
  @Output() selectNode = new EventEmitter<string>();
  @Output() toggleNode = new EventEmitter<string>();
  @Output() targetDrop = new EventEmitter<string>();
  @Output() dropHoverChange = new EventEmitter<string>();
  @Output() addNode = new EventEmitter<'field' | 'object' | 'array'>();
  @Output() renameNode = new EventEmitter<string>();
  @Output() updateNodeType = new EventEmitter<string>();
  @Output() updateNodeNullable = new EventEmitter<boolean>();
  @Output() removeNode = new EventEmitter<void>();
  @Output() expandAll = new EventEmitter<void>();
  @Output() collapseAll = new EventEmitter<void>();
  @Output() hoverConcatPort = new EventEmitter<number | null>();

  readonly texts = UI_TEXTS.target;
  readonly nodeTypeOptions = PROGRAMMING_TYPE_OPTION_GROUPS;
  technicalMode = false;
  technicalPanelMode: 'viewer' | 'editor' = 'viewer';
  search = '';
  viewFilter: 'all' | 'mapped' | 'unmapped' | 'leaves' | 'containers' = 'all';
  renameValue = '';
  editingNodeId = '';
  inlineRenameValue = '';
  hoveredDropNodeId = '';
  importedFile: ImportedFileSummary | null = null;

  toggleMode(mode: 'builder' | 'json'): void {
    this.technicalMode = mode == 'json';
    if (this.technicalMode && this.rawJsonText.trim()) {
      this.technicalPanelMode = 'viewer';
    }
  }

  onSelect(node: SchemaNodeDraft): void {
    this.renameValue = node.itemModel ? '' : node.key;
    this.selectNode.emit(node.id);
  }

  startInlineRename(node: SchemaNodeDraft, event?: Event): void {
    event?.stopPropagation();
    if (node.itemModel || node.kind == 'root') {
      return;
    }

    this.editingNodeId = node.id;
    this.inlineRenameValue = node.key;
  }

  commitInlineRename(nodeId: string, event?: Event): void {
    event?.stopPropagation();
    const nextValue = this.inlineRenameValue.trim();
    if (!nextValue) {
      this.cancelInlineRename();
      return;
    }

    this.selectNode.emit(nodeId);
    this.renameValue = nextValue;
    this.renameNode.emit(nextValue);
    this.editingNodeId = '';
    this.inlineRenameValue = '';
  }

  cancelInlineRename(event?: Event): void {
    event?.stopPropagation();
    this.editingNodeId = '';
    this.inlineRenameValue = '';
  }

  handleImportedFile(event: { content: string; summary: ImportedFileSummary }): void {
    this.importedFile = event.summary;
    this.importSchemaText.emit(event.content);
    this.technicalPanelMode = 'viewer';
  }

  clearImportedFile(): void {
    this.importedFile = null;
    this.rawJsonTextChange.emit('');
    this.importSchema.emit();
    this.technicalPanelMode = 'viewer';
  }

  setTechnicalPanelMode(mode: 'viewer' | 'editor'): void {
    this.technicalPanelMode = mode;
  }

  allowDrop(event: DragEvent, node: SchemaNodeDraft): void {
    event.preventDefault();
    if (!this.draggedSourcePath) {
      return;
    }

    this.hoveredDropNodeId = node.id;
    this.dropHoverChange.emit(node.id);
  }

  onDrop(event: DragEvent, nodeId: string): void {
    event.preventDefault();
    this.hoveredDropNodeId = '';
    this.dropHoverChange.emit('');
    this.targetDrop.emit(nodeId);
  }

  clearDropHover(nodeId?: string): void {
    if (!nodeId || this.hoveredDropNodeId == nodeId) {
      this.hoveredDropNodeId = '';
      this.dropHoverChange.emit('');
    }
  }

  updateSelectedNodeType(nextType: string): void {
    if (!nextType || this.selectedNode()?.kind != 'field') {
      return;
    }

    this.updateNodeType.emit(nextType);
  }

  updateSelectedNodeNullable(nextValue: boolean): void {
    if (!this.selectedNode() || this.selectedNode()?.kind == 'root') {
      return;
    }

    this.updateNodeNullable.emit(nextValue);
  }

  selectedNode(): SchemaNodeDraft | null {
    return this.findNode(this.nodes, this.selectedNodeId);
  }

  visibleNodeCount(nodes: SchemaNodeDraft[] = this.nodes): number {
    let count = 0;

    for (const node of nodes) {
      if (!this.matches(node)) {
        continue;
      }

      count += 1;
      count += this.visibleNodeCount(node.children);
    }

    return count;
  }

  breadcrumb(node: SchemaNodeDraft | null): string[] {
    if (!node) {
      return [];
    }

    return node.displayPath == 'destino' ? ['destino'] : ['destino', ...node.displayPath.split('.')];
  }

  clearFilters(): void {
    this.search = '';
    this.viewFilter = 'all';
  }

  searchMatches(nodes: SchemaNodeDraft[] = this.nodes): SchemaNodeDraft[] {
    const matches: SchemaNodeDraft[] = [];

    const walk = (items: SchemaNodeDraft[]) => {
      items.forEach((node) => {
        if (this.matches(node) && this.directSearchMatch(node)) {
          matches.push(node);
        }
        walk(node.children);
      });
    };

    walk(nodes);
    return matches;
  }

  highlightText(value: string): string {
    const search = this.search.trim();
    const escapedValue = this.escapeHtml(value);

    if (!search) {
      return escapedValue;
    }

    const normalizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(`(${normalizedSearch})`, 'ig');
    return escapedValue.replace(matcher, '<mark>$1</mark>');
  }

  matches(node: SchemaNodeDraft): boolean {
    const search = this.search.trim().toLowerCase();
    const matchesSearch =
      !search ||
      node.label.toLowerCase().includes(search) ||
      node.displayPath.toLowerCase().includes(search);
    const isMapped = this.mappedTargetIds.has(node.id);
    const matchesView =
      this.viewFilter == 'all' ||
      (this.viewFilter == 'mapped' && isMapped) ||
      (this.viewFilter == 'unmapped' && node.kind == 'field' && this.emptyTargetIds.has(node.id)) ||
      (this.viewFilter == 'leaves' && node.kind == 'field') ||
      (this.viewFilter == 'containers' && node.kind != 'field');

    if (matchesSearch && matchesView) {
      return true;
    }

    return node.children.some((child) => this.matches(child));
  }

  hasChildren(node: SchemaNodeDraft): boolean {
    return node.children.length > 0;
  }

  trackNode(_: number, node: SchemaNodeDraft): string {
    return node.id;
  }

  directSearchMatch(node: SchemaNodeDraft): boolean {
    const search = this.search.trim().toLowerCase();
    return (
      !search ||
      node.label.toLowerCase().includes(search) ||
      node.displayPath.toLowerCase().includes(search)
    );
  }

  fanInPorts(node: SchemaNodeDraft): number[] {
    if (
      node.kind != 'field' ||
      node.id != this.selectedNodeId ||
      !node.binding
    ) {
      return [];
    }

    const sourceCount = node.binding.mode == 'defaultSource'
      ? (node.binding.defaultSourcePath ? 1 : 0)
      : node.binding.sourcePaths.filter(Boolean).length;

    return sourceCount > 1 ? Array.from({ length: sourceCount }, (_, index) => index) : [];
  }

  setHoveredConcatPort(index: number | null): void {
    this.hoverConcatPort.emit(index);
  }

  dropEffect(node: SchemaNodeDraft): 'create' | 'append' | 'overwrite' | 'noop' | 'none' {
    if (!this.draggedSourcePath) {
      return 'none';
    }

    if (node.kind != 'field') {
      return 'create';
    }

    const mode = node.binding?.mode ?? 'unmapped';
    if (mode == 'unmapped') {
      return 'create';
    }

    if (mode == 'alias') {
      if (!node.binding?.sourcePaths.some(Boolean)) {
        return 'create';
      }

      return node.binding.sourcePaths.includes(this.draggedSourcePath) ? 'noop' : 'append';
    }

    if (mode == 'concat') {
      return node.binding?.sourcePaths.includes(this.draggedSourcePath) ? 'noop' : 'append';
    }

    return 'overwrite';
  }

  dropIntent(node: SchemaNodeDraft): 'alias' | 'concat' | 'new-child' | 'none' {
    if (!this.draggedSourcePath) {
      return 'none';
    }

    if (node.kind != 'field') {
      return 'new-child';
    }

    const mode = node.binding?.mode ?? 'unmapped';
    if (mode == 'alias' && !node.binding?.sourcePaths.includes(this.draggedSourcePath)) {
      return 'concat';
    }

    if (mode == 'concat') {
      return 'concat';
    }

    return 'alias';
  }

  dropIntentLabel(node: SchemaNodeDraft): string {
    const effect = this.dropEffect(node);
    switch (this.dropIntent(node)) {
      case 'alias':
        if (effect == 'overwrite') {
          return 'Drop para substituir a configuracao atual por alias';
        }
        if (effect == 'noop') {
          return 'Este alias ja esta ligado';
        }
        return 'Drop para criar alias';
      case 'concat':
        return effect == 'noop'
          ? 'Este campo ja participa do concat'
          : 'Drop para complementar o campo no concat';
      case 'new-child':
        return node.kind == 'array'
          ? 'Drop para criar campo no item-modelo'
          : 'Drop para criar campo filho ligado';
      default:
        return '';
    }
  }

  private findNode(nodes: SchemaNodeDraft[], nodeId: string): SchemaNodeDraft | null {
    for (const node of nodes) {
      if (node.id == nodeId) {
        return node;
      }

      const child = this.findNode(node.children, nodeId);
      if (child) {
        return child;
      }
    }

    return null;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
