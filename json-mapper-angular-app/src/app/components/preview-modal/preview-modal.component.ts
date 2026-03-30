import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PreviewTabsComponent } from '@app/components/preview-tabs/preview-tabs.component';

@Component({
  selector: 'app-preview-modal',
  standalone: true,
  imports: [CommonModule, PreviewTabsComponent],
  templateUrl: './preview-modal.component.html',
  styleUrl: './preview-modal.component.scss'
})
export class PreviewModalComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) copy = '';
  @Input({ required: true }) closeLabel = '';
  @Input({ required: true }) generatedSchema = '';
  @Input({ required: true }) previewJson = '';
  @Input({ required: true }) persistedDocument = '';
  @Input() exportFileBase = 'schema';
  @Input() validationErrors: string[] = [];

  @Output() close = new EventEmitter<void>();

  closeModal(): void {
    this.close.emit();
  }
}
