import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CodeEditorComponent } from '@app/components/code-editor/code-editor.component';
import { JsonTreeViewerComponent } from '@app/components/json-tree-viewer/json-tree-viewer.component';

export interface SchemaTechnicalImportedFile {
  name: string;
  mimeType: string;
  extension: string;
  sizeLabel: string;
}

@Component({
  selector: 'app-schema-technical-panel',
  standalone: true,
  imports: [CommonModule, CodeEditorComponent, JsonTreeViewerComponent],
  templateUrl: './schema-technical-panel.component.html',
  styleUrl: './schema-technical-panel.component.scss'
})
export class SchemaTechnicalPanelComponent {
  @ViewChild('fileInput') private readonly fileInput?: ElementRef<HTMLInputElement>;

  @Input({ required: true }) importTitle = '';
  @Input({ required: true }) importCopy = '';
  @Input({ required: true }) importAction = '';
  @Input() templateAction = '';
  @Input() templateHref = '';
  @Input() templateDownloadName = '';
  @Input({ required: true }) editorTitle = '';
  @Input({ required: true }) editorCopy = '';
  @Input({ required: true }) editorAction = '';
  @Input({ required: true }) editorFootnote = '';
  @Input({ required: true }) noFile = '';
  @Input({ required: true }) clearFile = '';
  @Input({ required: true }) viewerMode = 'Viewer';
  @Input({ required: true }) editorMode = 'Editar';
  @Input({ required: true }) viewerEmpty = '';
  @Input({ required: true }) rawJsonText = '';
  @Input() importedFile: SchemaTechnicalImportedFile | null = null;
  @Input() error = '';
  @Input() placeholder = '';
  @Input() helperText = '';
  @Input() fileName = 'schema.json';
  @Input() panelMode: 'viewer' | 'editor' = 'viewer';

  @Output() fileImported = new EventEmitter<{ content: string; summary: SchemaTechnicalImportedFile }>();
  @Output() clearFileRequested = new EventEmitter<void>();
  @Output() rawJsonTextChange = new EventEmitter<string>();
  @Output() applyText = new EventEmitter<void>();
  @Output() panelModeChange = new EventEmitter<'viewer' | 'editor'>();

  openFilePicker(): void {
    this.fileInput?.nativeElement.click();
  }

  async downloadTemplate(): Promise<void> {
    if (!this.templateHref) {
      return;
    }

    try {
      const response = await fetch(this.templateHref, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Falha ao baixar template: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = this.templateDownloadName || this.extractFileNameFromHref(this.templateHref);
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(this.templateHref, '_blank', 'noopener,noreferrer');
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      this.fileImported.emit({
        content,
        summary: {
          name: file.name,
          mimeType: file.type || 'application/json',
          extension: this.extractExtension(file.name),
          sizeLabel: this.formatFileSize(file.size)
        }
      });
      this.panelModeChange.emit('viewer');
    } finally {
      input.value = '';
    }
  }

  setPanelMode(mode: 'viewer' | 'editor'): void {
    this.panelModeChange.emit(mode);
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private extractExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'json';
  }

  private extractFileNameFromHref(value: string): string {
    const cleanValue = value.split('?')[0].split('#')[0];
    const segments = cleanValue.split('/');
    return segments[segments.length - 1] || 'template.json';
  }
}
