import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodeEditorComponent } from '../../../../shared-ui/code-editor/code-editor.component';
import { SchemaGeneratorService } from '../../../schema/application/schema-generator.service';
import { JSON_MAPPER_COPY_PT_BR } from '../../../../core';
import { MappingDraft, PROGRAMMING_TYPE_OPTION_GROUPS, SchemaNodeDraft, TargetBindingMode } from '../../../../core/models';
import { rankSuggestedSources } from '../../../../core/utils';

type LinkLaneKind = 'alias' | 'concat' | 'defaultSource' | 'fallback';
type EvalEditorLanguage = 'javascript' | 'java' | 'python';

@Component({
  selector: 'app-mapping-workbench',
  standalone: true,
  imports: [CommonModule, FormsModule, CodeEditorComponent],
  templateUrl: './mapping-workbench.component.html',
  styleUrl: './mapping-workbench.component.scss'
})
export class MappingWorkbenchComponent {
  @ViewChild('linkBuilderFrame') linkBuilderFrame?: ElementRef<HTMLElement>;
  private readonly schemaGenerator = inject(SchemaGeneratorService);

  readonly texts = JSON_MAPPER_COPY_PT_BR.workbench;
  readonly returnTypeOptions = PROGRAMMING_TYPE_OPTION_GROUPS;

  readonly evalExamples = [
    {
      label: 'Ternário JavaScript',
      value: "dadosApolice.estado == 'SP' ? 'SAOPAULO' : 'nao identificado'"
    },
    {
      label: 'Soma em loop',
      value:
        "var total = 0; for (const c of apolice.itens[0].coberturas) { if (c.valor != null) total += c.valor; } return total;"
    },
    {
      label: 'Ternário em Python',
      value: '"Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"'
    },
    {
      label: 'Ternário Java',
      value: 'return dadosApolice.codigoMarca == 1001 ? "Porto" : "Nao identificado";'
    }
  ];

  readonly scriptExamples = [
    {
      label: 'Ternário Java',
      value: 'return dadosApolice.codigoMarca == 1001 ? "Porto" : "Nao identificado";'
    },
    {
      label: 'Ternário JavaScript',
      value: 'return dadosApolice.codigoMarca == 1001 ? "Porto" : "Nao identificado";'
    },
    {
      label: 'Ternário Python',
      value: 'resultado = "Porto" if dadosApolice.codigoMarca == 1001 else "Nao identificado"\nreturn resultado'
    },
    {
      label: 'Loop Java',
      value:
        "BigDecimal total = BigDecimal.ZERO;\nfor (var item : apolice.getItens()) {\n  if (item.getValor() != null) {\n    total = total.add(item.getValor());\n  }\n}\nreturn total;"
    },
    {
      label: 'Loop Python',
      value:
        'total = 0\nfor item in apolice.itens:\n    if item.valor is not None:\n        total += item.valor\nreturn total'
    },
    {
      label: 'String fixa',
      value: 'return "APOLICE";'
    }
  ];

  @Input({ required: true }) mappedTargets: MappingDraft[] = [];
  @Input() selectedTargetNode: SchemaNodeDraft | null = null;
  @Input() targetTree: SchemaNodeDraft[] = [];
  @Input() sourceOptions: SchemaNodeDraft[] = [];
  @Input() sourceNodeOptions: SchemaNodeDraft[] = [];
  @Input() validationErrors: string[] = [];
  @Input() draggedSourcePath = '';
  @Input() bindingModes: Array<{ id: TargetBindingMode; label: string }> = [];
  @Input() reviewCounts: { empty: number; rule: number; error: number } = { empty: 0, rule: 0, error: 0 };
  @Input() ruleCount = 0;
  @Input() selectedTargetHasVisualRule = false;
  @Input() selectedTargetRuleCount = 0;
  @Input() hoveredConcatSegmentIndex: number | null = null;

  @Output() selectTarget = new EventEmitter<string>();
  @Output() setBindingMode = new EventEmitter<TargetBindingMode>();
  @Output() clearBinding = new EventEmitter<void>();
  @Output() setAliasSource = new EventEmitter<string>();
  @Output() addAliasFallback = new EventEmitter<string>();
  @Output() replaceAliasFallback = new EventEmitter<{ index: number; path: string }>();
  @Output() removeAliasFallback = new EventEmitter<number>();
  @Output() updateAliasStrategy = new EventEmitter<'first' | 'fallback'>();
  @Output() setDefaultLiteral = new EventEmitter<string>();
  @Output() setDefaultSource = new EventEmitter<string>();
  @Output() updateEvalExpression = new EventEmitter<string>();
  @Output() updateScriptLanguage = new EventEmitter<'java' | 'javascript' | 'python'>();
  @Output() updateScriptSource = new EventEmitter<string>();
  @Output() updateScriptReturnType = new EventEmitter<string>();
  @Output() updateMapFromSource = new EventEmitter<string>();
  @Output() addConcatSource = new EventEmitter<string>();
  @Output() replaceConcatSource = new EventEmitter<{ index: number; path: string }>();
  @Output() removeConcatSource = new EventEmitter<number>();
  @Output() moveConcatSource = new EventEmitter<{ index: number; direction: -1 | 1 }>();
  @Output() reorderConcatSource = new EventEmitter<{ fromIndex: number; toIndex: number }>();
  @Output() updateConcatSeparator = new EventEmitter<string>();
  @Output() applyConcatSeparatorPreset = new EventEmitter<string>();
  @Output() updateConcatFormat = new EventEmitter<{
    index: number;
    patch: Partial<{ pad: 'left' | 'right'; length: number; char: string }>;
  }>();
  @Output() clearConcatFormat = new EventEmitter<number>();
  @Output() updateAdvancedExpression = new EventEmitter<string>();
  @Output() applyDefaultLiteralPreset = new EventEmitter<string>();
  @Output() applySuggestedMapping = new EventEmitter<void>();
  @Output() applySuggestedMappingsBatch = new EventEmitter<void>();
  @Output() hoverConcatSegment = new EventEmitter<number | null>();

  draftConcatSource = '';
  draftAliasFallback = '';
  draftManualSourcePath = '';
  manualSourceQuery = '';
  draggingConcatIndex: number | null = null;
  hoveredConcatDropIndex: number | null = null;
  draggingWorkbenchSourcePath = '';
  hoveredLinkLane: LinkLaneKind | null = null;
  dragPointer: { x: number; y: number } | null = null;
  assistantsExpanded = false;

  setHoveredConcatSegment(index: number | null): void {
    this.hoverConcatSegment.emit(index);
  }

  trackMapping(_: number, mapping: MappingDraft): string {
    return mapping.id;
  }

  toNumber(value: string | number): number {
    return Number(value);
  }

  suggestionHint(): string {
    const mode = this.selectedTargetNode?.binding?.mode;
    if (mode == 'concat') {
      return 'Clique para adicionar uma origem ao concat atual.';
    }

    if (mode == 'defaultSource') {
      return 'Clique para usar um campo da origem como default.';
    }

    return 'Clique para preencher rapidamente o campo selecionado.';
  }

  toggleAssistants(): void {
    this.assistantsExpanded = !this.assistantsExpanded;
  }

  mappingsByMode(mode: TargetBindingMode): number {
    return this.mappedTargets.filter((mapping) => mapping.mode == mode).length;
  }

  selectedSourceLabels(): string[] {
    const node = this.selectedTargetNode;
    if (!node?.binding) {
      return [];
    }

    const paths = node.binding.mode == 'defaultSource'
      ? [node.binding.defaultSourcePath]
      : node.binding.sourcePaths;

    return paths
      .filter(Boolean)
      .map((path) => this.contextualSourceLabel(path, node));
  }

  sourceOptionLabel(source: SchemaNodeDraft, targetNode = this.selectedTargetNode): string {
    return this.contextualSourceLabel(source.path, targetNode ?? null);
  }

  evalEditorLanguage(node: SchemaNodeDraft | null): EvalEditorLanguage {
    const expression = node?.binding?.evalExpression ?? '';
    return this.detectEvalEditorLanguage(expression);
  }

  evalEditorLanguageLabel(node: SchemaNodeDraft | null): string {
    const language = this.evalEditorLanguage(node);
    if (language == 'python') {
      return 'Python';
    }

    if (language == 'java') {
      return 'Java';
    }

    return 'JavaScript / TypeScript';
  }

  evalEditorFileName(node: SchemaNodeDraft | null): string {
    const language = this.evalEditorLanguage(node);
    if (language == 'python') {
      return 'eval-expression.py';
    }

    if (language == 'java') {
      return 'eval-expression.java';
    }

    return 'eval-expression.ts';
  }

  evalEditorHelperText(node: SchemaNodeDraft | null): string {
    const language = this.evalEditorLanguage(node);
    if (language == 'python') {
      return 'Python detectado. Se o conteúdo tiver cara de código, o schema final inclui eval_type como script.';
    }

    if (language == 'java') {
      return 'Java detectado. Se o conteúdo tiver cara de código, o schema final inclui eval_type como script.';
    }

    return 'JavaScript / TypeScript detectado. Se o conteúdo tiver cara de código, o schema final inclui eval_type como script.';
  }

  evalDetectionBadge(node: SchemaNodeDraft | null): string {
    const expression = node?.binding?.evalExpression ?? '';
    return this.schemaGenerator.shouldPersistEvalAsScript(expression, node?.binding?.evalType)
      ? 'Script detectado'
      : 'Expressão declarativa';
  }

  scriptEditorLanguageLabel(node: SchemaNodeDraft | null): string {
    const language = node?.binding?.script?.language ?? 'java';
    if (language == 'python') {
      return 'Python';
    }

    return language == 'java' ? 'Java' : 'JavaScript';
  }

  scriptEditorFileName(node: SchemaNodeDraft | null): string {
    const language = node?.binding?.script?.language ?? 'java';
    if (language == 'python') {
      return 'transform-script.py';
    }

    return language == 'java' ? 'transform-script.java' : 'transform-script.js';
  }

  scriptEditorLanguage(node: SchemaNodeDraft | null): 'java' | 'javascript' | 'python' {
    const language = node?.binding?.script?.language ?? 'java';
    return language == 'python' ? 'python' : language == 'java' ? 'java' : 'javascript';
  }

  scriptEditorHelperText(node: SchemaNodeDraft | null): string {
    if (this.scriptEditorLanguage(node) == 'python') {
      return 'Python ativo. No schema final este bloco sera salvo como eval com eval_type igual a script.';
    }

    return this.scriptEditorLanguage(node) == 'java'
      ? 'Java ativo. No schema final este bloco sera salvo como eval com eval_type igual a script.'
      : 'JavaScript ativo. No schema final este bloco sera salvo como eval com eval_type igual a script.';
  }

  scriptDetectionBadge(node: SchemaNodeDraft | null): string {
    return (node?.binding?.script?.source ?? '').trim() ? 'Script detectado' : 'Script pronto para configurar';
  }

  contextualSourceLabel(sourcePath: string, targetNode: SchemaNodeDraft | null): string {
    const fallback =
      this.sourceOptions.find((source) => source.path == sourcePath)?.displayPath ??
      this.sourceNodeOptions.find((source) => source.path == sourcePath)?.displayPath ??
      sourcePath;

    if (!targetNode) {
      return fallback;
    }

    const mapFromAncestors = this.findMapFromAncestors(targetNode);
    if (mapFromAncestors.length == 0) {
      return fallback;
    }

    const candidatePrefixes = this.buildMapFromCandidatePrefixes(mapFromAncestors);
    const matchedPrefix = candidatePrefixes
      .sort((left, right) => right.length - left.length)
      .find((prefix) => sourcePath == prefix || sourcePath.startsWith(`${prefix}.`));

    if (!matchedPrefix) {
      return fallback;
    }

    if (sourcePath == matchedPrefix) {
      return this.lastPathSegment(matchedPrefix);
    }

    const relativePath = sourcePath.slice(matchedPrefix.length + 1);
    const contextualPath = this.stripTargetObjectContext(targetNode, mapFromAncestors[mapFromAncestors.length - 1]?.id ?? null, relativePath);

    return contextualPath || this.lastPathSegment(matchedPrefix);
  }

  suggestedSources(limit = 5): SchemaNodeDraft[] {
    return rankSuggestedSources(this.selectedTargetNode, this.sourceOptions, limit).map((item) => item.source);
  }

  filteredManualSources(limit = 12): SchemaNodeDraft[] {
    const query = this.manualSourceQuery.trim().toLowerCase();
    if (!query) {
      return this.sourceOptions.slice(0, limit);
    }

    return this.sourceOptions
      .filter((source) =>
        source.displayPath.toLowerCase().includes(query) ||
        source.path.toLowerCase().includes(query) ||
        source.type.toLowerCase().includes(query)
      )
      .slice(0, limit);
  }

  currentDragPath(): string {
    return this.draggedSourcePath || this.draggingWorkbenchSourcePath;
  }

  startConcatDrag(index: number, event?: DragEvent): void {
    this.draggingConcatIndex = index;
    this.hoveredConcatDropIndex = index;
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  dropConcatAt(index: number): void {
    if (this.draggingConcatIndex == null) {
      return;
    }

    this.reorderConcatSource.emit({ fromIndex: this.draggingConcatIndex, toIndex: index });
    this.draggingConcatIndex = null;
    this.hoveredConcatDropIndex = null;
  }

  clearConcatDrag(): void {
    this.draggingConcatIndex = null;
    this.hoveredConcatDropIndex = null;
  }

  previewConcatDrop(index: number): void {
    if (this.draggingConcatIndex == null) {
      return;
    }

    this.hoveredConcatDropIndex = index;
  }

  clearConcatDropPreview(index?: number): void {
    if (this.draggingConcatIndex == null) {
      this.hoveredConcatDropIndex = null;
      return;
    }

    if (index === undefined || this.hoveredConcatDropIndex == index) {
      this.hoveredConcatDropIndex = this.draggingConcatIndex;
    }
  }

  isConcatDropPreview(index: number): boolean {
    return this.draggingConcatIndex !== null && this.hoveredConcatDropIndex == index && this.draggingConcatIndex != index;
  }

  concatDropPreviewLabel(): string {
    if (this.draggingConcatIndex == null || this.hoveredConcatDropIndex == null) {
      return '';
    }

    if (this.draggingConcatIndex == this.hoveredConcatDropIndex) {
      return `Movendo Entrada ${this.draggingConcatIndex + 1}`;
    }

    return `Solte para mover a Entrada ${this.draggingConcatIndex + 1} para a posicao ${this.hoveredConcatDropIndex + 1}`;
  }

  hasActiveFormat(index: number): boolean {
    return (this.selectedTargetNode?.binding?.formatters?.[index]?.length ?? 0) > 0;
  }

  startWorkbenchDrag(path: string): void {
    this.draggingWorkbenchSourcePath = path;
  }

  clearWorkbenchDrag(): void {
    this.draggingWorkbenchSourcePath = '';
    this.hoveredLinkLane = null;
    this.dragPointer = null;
  }

  activateLane(kind: LinkLaneKind): void {
    if (!this.currentDragPath()) {
      return;
    }

    this.hoveredLinkLane = kind;
  }

  clearLane(kind?: LinkLaneKind): void {
    if (!kind || this.hoveredLinkLane == kind) {
      this.hoveredLinkLane = null;
    }
  }

  dropOnLane(kind: LinkLaneKind): void {
    const path = this.currentDragPath();
    if (!path) {
      return;
    }

    this.useManualSuggestion(path);
    this.applyManualSource(kind);
    this.clearWorkbenchDrag();
  }

  laneDescription(kind: LinkLaneKind): string {
    switch (kind) {
      case 'alias':
        return 'Substitui o alias principal do campo selecionado.';
      case 'concat':
        return 'Adiciona este campo como novo segmento do concat.';
      case 'defaultSource':
        return 'Usa o valor da origem como default dinamico.';
      case 'fallback':
        return 'Adiciona como alias de fallback.';
    }
  }

  trackLinkPointer(event: DragEvent): void {
    if (!this.currentDragPath()) {
      return;
    }

    this.updatePointerFromClient(event.clientX, event.clientY);
  }

  showLinkOverlay(): boolean {
    return !!this.currentDragPath();
  }

  linkOverlayViewBox(): string {
    const frame = this.linkBuilderFrame?.nativeElement;
    const width = frame?.clientWidth ?? 0;
    const height = frame?.clientHeight ?? 0;
    return `0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`;
  }

  linkOverlayPath(): string {
    if (!this.currentDragPath()) {
      return '';
    }

    const start = this.sourceAnchorPoint();
    const end = this.linkTargetPoint();
    if (!start || !end) {
      return '';
    }

    const curve = Math.max(48, Math.abs(end.x - start.x) * 0.45);
    return `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`;
  }

  linkOverlayEndX(): number {
    return this.linkTargetPoint()?.x ?? 0;
  }

  linkOverlayEndY(): number {
    return this.linkTargetPoint()?.y ?? 0;
  }

  applyManualSource(mode: 'alias' | 'concat' | 'defaultSource' | 'fallback'): void {
    const normalizedPath = this.normalizeManualSourcePath(this.draftManualSourcePath);
    if (!normalizedPath) {
      return;
    }

    switch (mode) {
      case 'alias':
        this.setAliasSource.emit(normalizedPath);
        break;
      case 'concat':
        this.addConcatSource.emit(normalizedPath);
        break;
      case 'defaultSource':
        this.setDefaultSource.emit(normalizedPath);
        break;
      case 'fallback':
        this.addAliasFallback.emit(normalizedPath);
        break;
    }
  }

  useManualSuggestion(path: string): void {
    this.draftManualSourcePath = path;
  }

  private findMapFromAncestors(node: SchemaNodeDraft): SchemaNodeDraft[] {
    const ancestors: SchemaNodeDraft[] = [];
    let currentParentId = node.parentId;

    while (currentParentId) {
      const parent = this.findTargetNodeById(currentParentId);
      if (!parent) {
        break;
      }

      if (parent.kind == 'array' && parent.mapFrom?.sourcePaths?.some(Boolean)) {
        ancestors.unshift(parent);
      }

      currentParentId = parent.parentId;
    }

    return ancestors;
  }

  private buildMapFromCandidatePrefixes(ancestors: SchemaNodeDraft[]): string[] {
    let prefixes: string[] = [];

    ancestors.forEach((ancestor) => {
      const sourcePaths = ancestor.mapFrom?.sourcePaths?.filter(Boolean) ?? [];
      if (sourcePaths.length == 0) {
        return;
      }

      if (prefixes.length == 0) {
        prefixes = sourcePaths.map((path) => this.ensureIndexedCollectionPath(path));
        return;
      }

      const nextPrefixes = new Set<string>();
      sourcePaths.forEach((path) => {
        nextPrefixes.add(this.ensureIndexedCollectionPath(path));

        const normalizedSegment = this.stripDollarPrefix(path);
        prefixes.forEach((prefix) => {
          nextPrefixes.add(this.ensureIndexedCollectionPath(`${prefix}.${normalizedSegment}`));
        });
      });

      prefixes = Array.from(nextPrefixes);
    });

    return prefixes;
  }

  private stripTargetObjectContext(
    targetNode: SchemaNodeDraft,
    nearestMapFromAncestorId: string | null,
    relativeSourcePath: string
  ): string {
    if (!nearestMapFromAncestorId) {
      return this.stripDollarPrefix(relativeSourcePath);
    }

    const objectContextSegments = this.buildTargetObjectContextSegments(targetNode, nearestMapFromAncestorId);
    const normalizedPath = this.stripDollarPrefix(relativeSourcePath);
    if (objectContextSegments.length == 0) {
      return normalizedPath;
    }

    const candidates = Array.from({ length: objectContextSegments.length }, (_, index) =>
      objectContextSegments.slice(index).join('.')
    );

    for (const candidate of candidates) {
      if (normalizedPath == candidate) {
        return '';
      }

      if (normalizedPath.startsWith(`${candidate}.`)) {
        return normalizedPath.slice(candidate.length + 1);
      }
    }

    return normalizedPath;
  }

  private buildTargetObjectContextSegments(targetNode: SchemaNodeDraft, nearestMapFromAncestorId: string): string[] {
    const segments: string[] = [];
    let currentNode =
      targetNode.kind == 'object' && !targetNode.itemModel
        ? targetNode
        : this.findTargetNodeById(targetNode.parentId);

    while (currentNode && currentNode.id != nearestMapFromAncestorId) {
      if (currentNode.kind == 'object' && !currentNode.itemModel) {
        segments.unshift(currentNode.key);
      }

      currentNode = this.findTargetNodeById(currentNode.parentId);
    }

    return segments;
  }

  private findTargetNodeById(nodeId: string | null): SchemaNodeDraft | null {
    if (!nodeId) {
      return null;
    }

    const stack = [...this.targetTree];
    while (stack.length) {
      const current = stack.pop()!;
      if (current.id == nodeId) {
        return current;
      }
      stack.push(...current.children);
    }
    return null;
  }

  private ensureIndexedCollectionPath(path: string): string {
    return path.endsWith('[0]') ? path : `${path}[0]`;
  }

  private stripDollarPrefix(path: string): string {
    return path.replace(/^\$\./, '').replace(/^\$/, '');
  }

  private lastPathSegment(path: string): string {
    const normalized = this.stripDollarPrefix(path).replace(/\[0\]/g, '');
    return normalized.split('.').filter(Boolean).at(-1) ?? normalized;
  }

  private detectEvalEditorLanguage(expression: string): EvalEditorLanguage {
    const normalized = expression
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .trim();
    if (!normalized) {
      return 'javascript';
    }

    const pythonSignals = [
      /\bdef\b/,
      /\belif\b/,
      /\bNone\b/,
      /\bTrue\b|\bFalse\b/,
      /\bfor\s+\w+\s+in\s+/,
      /\bif\b.+\belse\b/,
      /:\s*(\n|$)/
    ];

    if (pythonSignals.some((pattern) => pattern.test(normalized))) {
      return 'python';
    }

    const javaSignals = [
      /\bpublic\b/,
      /\bprivate\b/,
      /\bprotected\b/,
      /\bstatic\b/,
      /^\s*(?:String|Integer|Long|Double|Float|Boolean|BigDecimal|BigInteger|List|Map|Set|Optional|LocalDate|LocalDateTime|Date|Instant)\s+[A-Za-z_]\w*\s*=/m,
      /^\s*[A-Z]\w*(?:<[\w\s,?.<>]+>)?\s+[A-Za-z_]\w*\s*=/m,
      /\.\s*get[A-Z]\w*\s*\(/,
      /\bBigDecimal\b/,
      /\bSystem\./,
      /\bnew\s+[A-Z]\w*/,
      /\bfor\s*\([^)]*;[^)]*;[^)]*\)/,
      /\bfor\s*\(\s*var\s+\w+\s*:\s*/,
      /\btry\b/,
      /\bcatch\b/
    ];

    if (javaSignals.some((pattern) => pattern.test(normalized))) {
      return 'java';
    }

    return 'javascript';
  }

  private normalizeManualSourcePath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('$')) {
      return trimmed;
    }

    return trimmed.startsWith('.') ? `$${trimmed}` : `$.${trimmed}`;
  }

  private sourceAnchorPoint(): { x: number; y: number } | null {
    return this.relativeRectPoint('[data-link-source-anchor]', 'right');
  }

  private linkTargetPoint(): { x: number; y: number } | null {
    if (this.hoveredLinkLane) {
      return this.relativeRectPoint(`[data-link-lane="${this.hoveredLinkLane}"]`, 'left');
    }

    return this.dragPointer ?? this.relativeRectPoint('[data-link-target-anchor]', 'left');
  }

  private relativeRectPoint(selector: string, edge: 'left' | 'right'): { x: number; y: number } | null {
    const frame = this.linkBuilderFrame?.nativeElement;
    if (!frame) {
      return null;
    }

    const element = frame.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const frameRect = frame.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      x: (edge == 'right' ? rect.right : rect.left) - frameRect.left,
      y: rect.top - frameRect.top + rect.height / 2
    };
  }

  private updatePointerFromClient(clientX: number, clientY: number): void {
    const frame = this.linkBuilderFrame?.nativeElement;
    if (!frame) {
      return;
    }

    const frameRect = frame.getBoundingClientRect();
    this.dragPointer = {
      x: Math.max(0, Math.min(frameRect.width, clientX - frameRect.left)),
      y: Math.max(0, Math.min(frameRect.height, clientY - frameRect.top))
    };
  }

}





