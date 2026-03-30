import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { JsonNode, buildJsonTree, walkJsonTree } from '@utils/json-tree.utils';

@Component({
  selector: 'app-json-tree-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './json-tree-viewer.component.html',
  styleUrl: './json-tree-viewer.component.scss'
})
export class JsonTreeViewerComponent {
  @Input({ required: true }) content = '';
  @Input() emptyMessage = 'Nenhum JSON disponivel.';
  @Input() fileName = 'schema.json';
  @Input() minHeight = 360;
  @Input() showToolbar = true;
  @Input() allowExport = false;

  private readonly collapsedPaths = new Set<string>();

  tree(): JsonNode | null {
    return buildJsonTree(this.content);
  }

  isCollapsed(path: string): boolean {
    return this.collapsedPaths.has(path);
  }

  toggleNode(path: string): void {
    if (this.collapsedPaths.has(path)) {
      this.collapsedPaths.delete(path);
      return;
    }

    this.collapsedPaths.add(path);
  }

  collapseAll(): void {
    const tree = this.tree();
    if (!tree) {
      return;
    }

    walkJsonTree(tree, (node) => {
      if (node.children?.length) {
        this.collapsedPaths.add(node.path);
      }
    });
  }

  expandAll(): void {
    const tree = this.tree();
    if (!tree) {
      return;
    }

    walkJsonTree(tree, (node) => this.collapsedPaths.delete(node.path));
  }

  copyContent(): void {
    if (!this.content || typeof navigator == 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    void navigator.clipboard.writeText(this.content);
  }

  exportContent(): void {
    if (!this.allowExport || !this.content || typeof document == 'undefined') {
      return;
    }

    const blob = new Blob([this.content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  valueTypeLabel(node: JsonNode): string {
    if (node.type == 'object') {
      return `{${node.size ?? 0}}`;
    }

    if (node.type == 'array') {
      return `[${node.size ?? 0}]`;
    }

    return node.type;
  }

  evalBadgeLabel(node: JsonNode): string | null {
    if (node.key != 'eval' || node.type != 'object' || !node.children?.length) {
      return null;
    }

    const evalTypeNode = node.children.find((child) => child.key == 'eval_type');
    const normalizedEvalType = String(evalTypeNode?.value ?? '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .toLowerCase();

    if (normalizedEvalType == 'script') {
      return 'Script detectado';
    }

    const aliasNode = node.children.find((child) => child.key == 'alias');
    if (aliasNode) {
      return 'Expressão declarativa';
    }

    return null;
  }

  evalBadgeTone(node: JsonNode): 'script' | 'declarative' | null {
    const label = this.evalBadgeLabel(node);
    if (label == 'Script detectado') {
      return 'script';
    }

    if (label == 'Expressão declarativa') {
      return 'declarative';
    }

    return null;
  }

  trackNode(_: number, node: JsonNode): string {
    return node.path;
  }
}
