import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CodeEditorComponent } from '../code-editor/code-editor.component';
import { JsonTreeViewerComponent } from '../json-tree-viewer/json-tree-viewer.component';

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
  @Input() importTitle = '';
  @Input() importCopy = '';
  @Input() importAction = '';
  @Input() templateAction = '';
  @Input() templateHref = '';
  @Input() templateDownloadName = 'schema.json';
  @Input() editorTitle = '';
  @Input() editorCopy = '';
  @Input() editorAction = '';
  @Input() editorFootnote = '';
  @Input() noFile = '';
  @Input() clearFile = '';
  @Input() viewerMode = '';
  @Input() editorMode = '';
  @Input() viewerEmpty = '';
  @Input() rawJsonText = '';
  @Input() importedFile: SchemaTechnicalImportedFile | null = null;
  @Input() error = '';
  @Input() panelMode: 'viewer' | 'editor' = 'viewer';
  @Input() fileName = 'schema.json';
  @Input() placeholder = '';
  @Input() helperText = '';
  @Input() editorLanguage: 'json' | 'javascript' | 'typescript' | 'java' | 'python' = 'json';
  @Input() viewerTheme: 'darcula' | 'light' = 'darcula';

  @Output() fileImported = new EventEmitter<{ content: string; summary: SchemaTechnicalImportedFile }>();
  @Output() clearFileRequested = new EventEmitter<void>();
  @Output() rawJsonTextChange = new EventEmitter<string>();
  @Output() applyText = new EventEmitter<void>();
  @Output() panelModeChange = new EventEmitter<'viewer' | 'editor'>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  @Input() set title(value: string) {
    this.importTitle = value;
  }

  @Input() set copy(value: string) {
    this.importCopy = value;
  }

  @Input() set emptyLabel(value: string) {
    this.viewerEmpty = value;
  }

  @Input() set editorActionLabel(value: string) {
    this.editorAction = value;
  }

  @Input() set viewerModeLabel(value: string) {
    this.viewerMode = value;
  }

  @Input() set editorModeLabel(value: string) {
    this.editorMode = value;
  }

  @Input() set rawJson(value: string) {
    this.rawJsonText = value;
  }

  @Output() rawJsonChange = this.rawJsonTextChange;
  @Output() applyManualText = this.applyText;
  @Output() clearImportedFile = this.clearFileRequested;

  openFilePicker(): void {
    this.fileInput?.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      if (input) {
        input.value = '';
      }
      return;
    }

    const content = await file.text();
    const extension = file.name.includes('.') ? file.name.split('.').pop() ?? 'json' : 'json';
    const summary: SchemaTechnicalImportedFile = {
      name: file.name,
      mimeType: file.type || 'application/json',
      extension,
      sizeLabel: this.formatFileSize(file.size)
    };

    this.fileImported.emit({ content, summary });
    this.setPanelMode('viewer');

    if (input) {
      input.value = '';
    }
  }

  async downloadTemplate(): Promise<void> {
    if (!this.templateHref) {
      return;
    }

    try {
      const response = await fetch(this.templateHref);
      if (!response.ok) {
        throw new Error(`Falha ao baixar template: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = this.templateDownloadName || 'schema.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(this.templateHref, '_blank', 'noopener,noreferrer');
    }
  }

  setPanelMode(mode: 'viewer' | 'editor'): void {
    this.panelMode = mode;
    this.panelModeChange.emit(mode);
  }

  onRawJsonChange(value: string): void {
    this.rawJsonTextChange.emit(value);
  }

  onApplyText(): void {
    this.applyText.emit();
  }

  private formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    const kb = size / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    return `${(kb / 1024).toFixed(1)} MB`;
  }
}
