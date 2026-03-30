import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SchemaTechnicalPanelComponent } from '../../../../shared-ui/schema-technical-panel/schema-technical-panel.component';
import { JSON_MAPPER_COPY_PT_BR } from '../../../../core';
import { PROGRAMMING_TYPE_OPTION_GROUPS, SchemaNodeDraft } from '../../../../core/models';

export interface ImportedFileSummary {
  name: string;
  mimeType: string;
  extension: string;
  sizeLabel: string;
}

@Component({
  selector: 'app-source-schema-tree',
  standalone: true,
  imports: [CommonModule, FormsModule, SchemaTechnicalPanelComponent],
  templateUrl: './source-schema-tree.component.html',
  styleUrl: './source-schema-tree.component.scss'
})
export class SourceSchemaTreeComponent {
  @Input({ required: true }) rawJsonText = '';
  @Input() sourceError = '';
  @Input({ required: true }) nodes: SchemaNodeDraft[] = [];
  @Input() selectedNodeId = '';
  @Input() usedPaths = new Set<string>();

  @Output() rawJsonTextChange = new EventEmitter<string>();
  @Output() importSchema = new EventEmitter<void>();
  @Output() importSchemaText = new EventEmitter<string>();
  @Output() selectNode = new EventEmitter<string>();
  @Output() toggleNode = new EventEmitter<string>();
  @Output() startDrag = new EventEmitter<string>();
  @Output() endDrag = new EventEmitter<void>();
  @Output() addNode = new EventEmitter<'field' | 'object' | 'array'>();
  @Output() renameNode = new EventEmitter<string>();
  @Output() updateNodeType = new EventEmitter<string>();
  @Output() updateNodeNullable = new EventEmitter<boolean>();
  @Output() removeNode = new EventEmitter<void>();
  @Output() expandAll = new EventEmitter<void>();
  @Output() collapseAll = new EventEmitter<void>();

  readonly texts = JSON_MAPPER_COPY_PT_BR.source;
  readonly nodeTypeOptions = PROGRAMMING_TYPE_OPTION_GROUPS;
  technicalMode = false;
  technicalPanelMode: 'viewer' | 'editor' = 'viewer';
  search = '';
  typeFilter = 'all';
  usageFilter: 'all' | 'used' | 'unused' | 'leaves' = 'all';
  renameValue = '';
  editingNodeId = '';
  inlineRenameValue = '';
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

  onDragStart(event: DragEvent, node: SchemaNodeDraft): void {
    if (node.kind != 'field') {
      return;
    }

    event.dataTransfer?.setData('text/plain', node.path);
    this.startDrag.emit(node.path);
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

  visibleLeafCount(nodes: SchemaNodeDraft[] = this.nodes): number {
    let count = 0;

    for (const node of nodes) {
      if (!this.matches(node)) {
        continue;
      }

      if (node.kind == 'field') {
        count += 1;
      }

      count += this.visibleLeafCount(node.children);
    }

    return count;
  }

  breadcrumb(node: SchemaNodeDraft | null): string[] {
    if (!node) {
      return [];
    }

    return node.displayPath == 'origem' ? ['origem'] : ['origem', ...node.displayPath.split('.')];
  }

  clearFilters(): void {
    this.search = '';
    this.typeFilter = 'all';
    this.usageFilter = 'all';
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
    const matchesType = this.typeFilter == 'all' || node.type == this.typeFilter || node.kind == this.typeFilter;
    const matchesUsage =
      this.usageFilter == 'all' ||
      (this.usageFilter == 'used' && this.usedPaths.has(node.path)) ||
      (this.usageFilter == 'unused' && node.kind == 'field' && !this.usedPaths.has(node.path)) ||
      (this.usageFilter == 'leaves' && node.kind == 'field');

    if (matchesSearch && matchesType && matchesUsage) {
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





