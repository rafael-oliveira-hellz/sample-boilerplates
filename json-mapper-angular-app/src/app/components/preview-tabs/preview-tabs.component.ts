import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { JsonTreeViewerComponent } from '@app/components/json-tree-viewer/json-tree-viewer.component';

@Component({
  selector: 'app-preview-tabs',
  standalone: true,
  imports: [CommonModule, JsonTreeViewerComponent],
  templateUrl: './preview-tabs.component.html',
  styleUrl: './preview-tabs.component.scss'
})
export class PreviewTabsComponent {
  @Input({ required: true }) generatedSchema = '';
  @Input({ required: true }) previewJson = '';
  @Input({ required: true }) persistedDocument = '';
  @Input() exportFileBase = 'schema';
  @Input() validationErrors: string[] = [];

  activeTab: 'schema' | 'errors' = 'schema';

  lineCount(content: string): number {
    return content ? content.split('\n').length : 0;
  }

  activeFileName(): string {
    const base = this.sanitizeFileName(this.exportFileBase || 'schema');
    const timestamp = this.buildTimestamp();

    switch (this.activeTab) {
      case 'schema':
        return `${base}_schema_${timestamp}.json`;
      default:
        return `${base}_validacao_${timestamp}.json`;
    }
  }

  private sanitizeFileName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  private buildTimestamp(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
  }
}
