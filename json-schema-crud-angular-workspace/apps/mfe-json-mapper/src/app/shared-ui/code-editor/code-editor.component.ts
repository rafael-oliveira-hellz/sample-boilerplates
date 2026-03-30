import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    PLATFORM_ID,
    SimpleChanges,
    ViewChild,
    inject,
    isDevMode
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type * as Monaco from 'monaco-editor';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './code-editor.component.html',
  styleUrl: './code-editor.component.scss'
})
export class CodeEditorComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() value = '';
  @Input() language = 'javascript';
  @Input() fileName = 'editor.txt';
  @Input() placeholder = '';
  @Input() helperText = '';
  @Input() minHeight = 240;
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('monacoHost') private readonly monacoHost?: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private editor?: Monaco.editor.IStandaloneCodeEditor;
  private editorModel?: Monaco.editor.ITextModel;
  useFallback = true;

  get lineNumbers(): number[] {
    const total = Math.max(this.value.split('\n').length, 1);
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  ngOnInit(): void {
    this.useFallback = !this.canUseMonaco();
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.useFallback) {
      return;
    }

    try {
      const { default: loader } = await import('@monaco-editor/loader');
      const monaco = await loader.init();
      this.editorModel = monaco.editor.createModel(this.value, this.language);
      this.editor = monaco.editor.create(this.monacoHost?.nativeElement as HTMLDivElement, {
        model: this.editorModel,
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: 'Consolas, "Courier New", monospace',
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        padding: { top: 14, bottom: 14 },
        overviewRulerLanes: 0
      });

      const editor = this.editor;
      if (!editor) {
        this.useFallback = true;
        return;
      }

      editor.onDidChangeModelContent(() => {
        const nextValue = this.editor?.getValue() ?? '';
        this.value = nextValue;
        this.valueChange.emit(nextValue);
      });
    } catch (error) {
      this.useFallback = true;
      if (isDevMode()) {
        console.warn('Nao foi possivel carregar Monaco, usando fallback.', error);
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['language'] && !changes['language'].firstChange && this.editorModel) {
      const nextLanguage = this.language || 'plaintext';
      import('@monaco-editor/loader').then(({ default: loader }) => loader.init()).then((monaco) => {
        if (this.editorModel) {
          monaco.editor.setModelLanguage(this.editorModel, nextLanguage);
        }
      }).catch(() => {
        this.useFallback = true;
      });
    }

    if (changes['value'] && !changes['value'].firstChange) {
      const nextValue = this.value ?? '';
      if (this.editor && this.editor.getValue() != nextValue) {
        this.editor.setValue(nextValue);
      }
    }
  }

  ngOnDestroy(): void {
    this.editor?.dispose();
    this.editorModel?.dispose();
  }

  onFallbackInput(event: Event): void {
    const nextValue = (event.target as HTMLTextAreaElement).value;
    this.value = nextValue;
    this.valueChange.emit(nextValue);
  }

  private canUseMonaco(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const hostWindow = window as Window & { __karma__?: unknown; Cypress?: unknown };
    return !hostWindow.__karma__ && !hostWindow.Cypress;
  }
}
