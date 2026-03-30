import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MappingWorkbenchComponent,
  PreviewModalComponent,
  RuleBuilderDrawerComponent,
  SourceSchemaTreeComponent,
  TargetSchemaBuilderComponent
} from './features';
import { JSON_MAPPER_COPY_PT_BR, MapperFacadeService } from './core';
import { SchemaNodeDraft, TargetBindingMode } from './core/models';

type WorkspaceConnection = {
  id: string;
  path: string;
  tone: 'default' | 'create' | 'append' | 'overwrite' | 'noop';
  endX: number;
  endY: number;
  kind: 'persistent' | 'drag';
  portIndex: number | null;
  highlighted: boolean;
  dimmed: boolean;
  start?: { x: number; y: number };
  controlStart?: { x: number; y: number };
  controlEnd?: { x: number; y: number };
  end?: { x: number; y: number };
};

type PersistentWorkspaceConnection = WorkspaceConnection & {
  kind: 'persistent';
  portIndex: number;
};

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    SourceSchemaTreeComponent,
    MappingWorkbenchComponent,
    TargetSchemaBuilderComponent,
    RuleBuilderDrawerComponent,
    PreviewModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderGrid') builderGrid?: ElementRef<HTMLElement>;
  @ViewChild('sourceColumn') sourceColumn?: ElementRef<HTMLElement>;
  @ViewChild('targetColumn') targetColumn?: ElementRef<HTMLElement>;

  readonly facade = inject(MapperFacadeService);
  readonly texts = JSON_MAPPER_COPY_PT_BR.app;
  private readonly cdr = inject(ChangeDetectorRef);
  dragPointer: { x: number; y: number } | null = null;
  hoveredTargetNodeId = '';
  overlayReady = false;
  previewModalOpen = false;
  private explicitHoveredConcatSegmentIndex: number | null = null;
  private lineHoveredConcatSegmentIndex: number | null = null;
  private readonly handleScrollOrResize = () => this.refreshWorkspaceOverlay();

  ngAfterViewInit(): void {
    this.builderGrid?.nativeElement.addEventListener('scroll', this.handleScrollOrResize, true);
    queueMicrotask(() => {
      this.overlayReady = true;
      this.refreshWorkspaceOverlay();
    });
  }

  ngOnDestroy(): void {
    this.builderGrid?.nativeElement.removeEventListener('scroll', this.handleScrollOrResize, true);
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    this.refreshWorkspaceOverlay();
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.previewModalOpen) {
      this.closePreviewModal();
    }
  }

  openPreviewModal(): void {
    this.previewModalOpen = true;
  }

  closePreviewModal(): void {
    this.previewModalOpen = false;
  }

  setHoveredTargetNode(nodeId: string): void {
    this.hoveredTargetNodeId = nodeId;
    this.refreshWorkspaceOverlay();
  }

  trackWorkspaceDrag(event: DragEvent): void {
    if (!this.facade.dragSourcePath()) {
      return;
    }

    this.dragPointer = {
      x: event.clientX,
      y: event.clientY
    };
    this.refreshWorkspaceOverlay();
  }

  clearWorkspaceDrag(): void {
    this.dragPointer = null;
    this.hoveredTargetNodeId = '';
    this.refreshWorkspaceOverlay();
  }

  setHoveredConcatSegment(index: number | null): void {
    this.explicitHoveredConcatSegmentIndex = index;
    this.refreshWorkspaceOverlay();
  }

  hoveredConcatSegmentIndex(): number | null {
    return this.explicitHoveredConcatSegmentIndex ?? this.lineHoveredConcatSegmentIndex;
  }

  trackWorkspaceHover(event: MouseEvent): void {
    if (this.explicitHoveredConcatSegmentIndex !== null) {
      return;
    }

    const closest = this.closestPersistentConnection(event.clientX, event.clientY);
    this.lineHoveredConcatSegmentIndex = closest?.portIndex ?? null;
    this.refreshWorkspaceOverlay();
  }

  clearWorkspaceHover(): void {
    if (this.lineHoveredConcatSegmentIndex === null) {
      return;
    }

    this.lineHoveredConcatSegmentIndex = null;
    this.refreshWorkspaceOverlay();
  }

  showWorkspaceLinkOverlay(): boolean {
    if (!this.overlayReady) {
      return false;
    }

    return this.workspaceConnections().length > 0;
  }

  workspaceLinkViewBox(): string {
    return `0 0 ${Math.max(window.innerWidth, 1)} ${Math.max(window.innerHeight, 1)}`;
  }

  workspaceLinkTone(): 'default' | 'create' | 'append' | 'overwrite' | 'noop' {
    if (!this.facade.dragSourcePath()) {
      return 'default';
    }

    const node = this.findTargetNode(this.hoveredTargetNodeId);
    if (!node) {
      return 'default';
    }

    return this.dropEffectForNode(node);
  }

  workspaceLinkLabel(): string {
    switch (this.workspaceLinkTone()) {
      case 'create':
        return 'criando';
      case 'append':
        return 'complementando';
      case 'overwrite':
        return 'sobrescrevendo';
      case 'noop':
        return 'ja ligado';
      default:
        return this.facade.dragSourcePath() ? 'arrastando' : 'ligado';
    }
  }

  workspaceLinkLabelX(): number {
    const points = this.dragWorkspaceEndpoints();
    if (!points) {
      return 0;
    }

    return (points.start.x + points.end.x) / 2;
  }

  workspaceLinkLabelY(): number {
    const points = this.dragWorkspaceEndpoints();
    if (!points) {
      return 0;
    }

    return Math.min(points.start.y, points.end.y) + Math.abs(points.end.y - points.start.y) * 0.45 - 14;
  }

  workspaceConnections(): WorkspaceConnection[] {
    const connections: WorkspaceConnection[] = [];

    const persistent = this.persistentWorkspaceConnections();
    connections.push(...persistent);

    const dragEndpoints = this.dragWorkspaceEndpoints();
    if (dragEndpoints) {
      connections.push({
        id: `drag:${this.facade.dragSourcePath()}`,
        ...this.buildConnectionGeometry(dragEndpoints.start, dragEndpoints.end),
        tone: this.workspaceLinkTone(),
        kind: 'drag',
        portIndex: null,
        highlighted: false,
        dimmed: false
      });
    }

    return connections;
  }

  private anchorPoint(
    element: HTMLElement | undefined,
    edge: 'left' | 'right',
    fallbackContainer?: HTMLElement
  ): { x: number; y: number } | null {
    if (!element) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    const viewport = this.visibilityViewport(element) ?? fallbackContainer;
    const viewportRect = viewport?.getBoundingClientRect();
    const verticalInset = 18;
    const yBase = rect.top + rect.height / 2;
    let y = yBase;
    let x = edge == 'right' ? rect.right : rect.left;

    if (viewportRect) {
      const minY = viewportRect.top + verticalInset;
      const maxY = viewportRect.bottom - verticalInset;
      const isOutside = rect.bottom < viewportRect.top || rect.top > viewportRect.bottom;

      y = Math.min(Math.max(yBase, minY), maxY);

      if (isOutside) {
        x = edge == 'right' ? viewportRect.right : viewportRect.left;
      } else {
        x = edge == 'right'
          ? Math.min(rect.right, viewportRect.right)
          : Math.max(rect.left, viewportRect.left);
      }
    }

    return {
      x,
      y
    };
  }

  private nodeAnchorPoint(
    attributeName: 'data-node-id' | 'data-source-path',
    attributeValue: string,
    edge: 'left' | 'right'
  ): { x: number; y: number } | null {
    const grid = this.builderGrid?.nativeElement;
    if (!grid || !attributeValue) {
      return null;
    }

    const escapedValue = attributeValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const element = grid.querySelector(`[${attributeName}="${escapedValue}"]`);
    const fallbackContainer = attributeName == 'data-source-path'
      ? this.sourceColumn?.nativeElement
      : this.targetColumn?.nativeElement;
    return element instanceof HTMLElement ? this.anchorPoint(element, edge, fallbackContainer) : null;
  }

  private activeWorkspaceSourcePath(): string {
    return this.facade.dragSourcePath() || this.selectedLinkedSourcePath();
  }

  private selectedLinkedSourcePath(): string {
    const selectedTarget = this.facade.selectedTargetNode();
    if (!selectedTarget?.binding) {
      return '';
    }

    if (selectedTarget.binding.mode == 'defaultSource') {
      return selectedTarget.binding.defaultSourcePath;
    }

    return selectedTarget.binding.sourcePaths.find(Boolean) ?? '';
  }

  private findTargetNode(nodeId: string): SchemaNodeDraft | null {
    const walk = (nodes: SchemaNodeDraft[]): SchemaNodeDraft | null => {
      for (const node of nodes) {
        if (node.id == nodeId) {
          return node;
        }

        const child = walk(node.children);
        if (child) {
          return child;
        }
      }

      return null;
    };

    return nodeId ? walk(this.facade.targetTree()) : null;
  }

  private dropEffectForNode(node: SchemaNodeDraft): 'create' | 'append' | 'overwrite' | 'noop' {
    const draggedSourcePath = this.facade.dragSourcePath();
    if (!draggedSourcePath) {
      return 'create';
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

      return node.binding.sourcePaths.includes(draggedSourcePath) ? 'noop' : 'append';
    }

    if (mode == 'concat') {
      return node.binding?.sourcePaths.includes(draggedSourcePath) ? 'noop' : 'append';
    }

    return 'overwrite';
  }

  private dragWorkspaceEndpoints(): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
    const sourcePath = this.facade.dragSourcePath();
    if (!sourcePath) {
      return null;
    }

    const start =
      this.nodeAnchorPoint('data-source-path', sourcePath, 'right') ??
      this.anchorPoint(this.sourceColumn?.nativeElement, 'right', this.sourceColumn?.nativeElement);
    const end =
      this.dragPointer ??
      this.nodeAnchorPoint('data-node-id', this.hoveredTargetNodeId || this.facade.selectedTargetNodeId(), 'left') ??
      this.anchorPoint(this.targetColumn?.nativeElement, 'left', this.targetColumn?.nativeElement);

    return start && end ? { start, end } : null;
  }

  private persistentWorkspaceConnections(): PersistentWorkspaceConnection[] {
    const selectedTarget = this.facade.selectedTargetNode();
    if (!selectedTarget?.binding || selectedTarget.kind != 'field') {
      return [];
    }

    const sourcePaths = selectedTarget.binding.mode == 'defaultSource'
      ? [selectedTarget.binding.defaultSourcePath].filter(Boolean)
      : selectedTarget.binding.sourcePaths.filter(Boolean);

    if (sourcePaths.length == 0) {
      return [];
    }

    const targetAnchor =
      this.nodeAnchorPoint('data-node-id', selectedTarget.id, 'left') ??
      this.anchorPoint(this.targetColumn?.nativeElement, 'left', this.targetColumn?.nativeElement);

    if (!targetAnchor) {
      return [];
    }

    const activeHoverIndex = this.hoveredConcatSegmentIndex();

    const connections = sourcePaths
      .map<PersistentWorkspaceConnection | null>((sourcePath: string, index: number) => {
        const start = this.nodeAnchorPoint('data-source-path', sourcePath, 'right');
        if (!start) {
          return null;
        }

        const portAnchor = this.targetPortAnchorPoint(selectedTarget.id, index);
        const offset = this.connectionSpreadOffset(index, sourcePaths.length);
        const end = portAnchor ?? { x: targetAnchor.x, y: targetAnchor.y + offset };
        const geometry = this.buildConnectionGeometry(start, end);

        return {
          id: `persistent:${selectedTarget.id}:${sourcePath}`,
          ...geometry,
          tone: this.persistentConnectionTone(selectedTarget.binding?.mode ?? 'unmapped', sourcePaths.length),
          kind: 'persistent' as const,
          portIndex: index,
          highlighted: activeHoverIndex == index,
          dimmed: activeHoverIndex !== null && activeHoverIndex != index
        };
      })
      .filter((item: PersistentWorkspaceConnection | null): item is PersistentWorkspaceConnection => item !== null);

    return connections;
  }

  private buildConnectionGeometry(start: { x: number; y: number }, end: { x: number; y: number }): Pick<
    WorkspaceConnection,
    'path' | 'start' | 'controlStart' | 'controlEnd' | 'end' | 'endX' | 'endY'
  > {
    const curve = Math.max(72, Math.abs(end.x - start.x) * 0.32);
    const controlStart = { x: start.x + curve, y: start.y };
    const controlEnd = { x: end.x - curve, y: end.y };
    return {
      path: `M ${start.x} ${start.y} C ${controlStart.x} ${controlStart.y}, ${controlEnd.x} ${controlEnd.y}, ${end.x} ${end.y}`,
      start,
      controlStart,
      controlEnd,
      end,
      endX: end.x,
      endY: end.y
    };
  }

  private connectionSpreadOffset(index: number, total: number): number {
    if (total <= 1) {
      return 0;
    }

    const middle = (total - 1) / 2;
    return (index - middle) * 14;
  }

  private targetPortAnchorPoint(targetNodeId: string, portIndex: number): { x: number; y: number } | null {
    const grid = this.builderGrid?.nativeElement;
    if (!grid) {
      return null;
    }

    const element = grid.querySelector(
      `[data-target-port-parent="${targetNodeId}"][data-target-port-index="${portIndex}"]`
    );

    return element instanceof HTMLElement
      ? this.anchorPoint(element, 'left', this.targetColumn?.nativeElement)
      : null;
  }

  private persistentConnectionTone(
    mode: TargetBindingMode | 'unmapped',
    sourceCount: number
  ): 'default' | 'create' | 'append' | 'overwrite' | 'noop' {
    if (mode == 'concat' || sourceCount > 1) {
      return 'append';
    }

    if (mode == 'defaultSource') {
      return 'create';
    }

    return 'default';
  }

  private visibilityViewport(element: HTMLElement): HTMLElement | null {
    const scrollContainer = element.closest('.tree-shell');
    return scrollContainer instanceof HTMLElement ? scrollContainer : null;
  }

  private refreshWorkspaceOverlay(): void {
    this.cdr.markForCheck();
  }

  private closestPersistentConnection(clientX: number, clientY: number): WorkspaceConnection | null {
    const persistent = this.workspaceConnections().filter(
      (connection) =>
        connection.kind == 'persistent' &&
        connection.start &&
        connection.controlStart &&
        connection.controlEnd &&
        connection.end
    );

    let best: { connection: WorkspaceConnection; distance: number } | null = null;

    for (const connection of persistent) {
      const distance = this.distanceToBezier(
        { x: clientX, y: clientY },
        connection.start!,
        connection.controlStart!,
        connection.controlEnd!,
        connection.end!
      );

      if (distance <= 16 && (!best || distance < best.distance)) {
        best = { connection, distance };
      }
    }

    return best?.connection ?? null;
  }

  private distanceToBezier(
    point: { x: number; y: number },
    start: { x: number; y: number },
    controlStart: { x: number; y: number },
    controlEnd: { x: number; y: number },
    end: { x: number; y: number }
  ): number {
    let minDistance = Number.POSITIVE_INFINITY;

    for (let step = 0; step <= 24; step += 1) {
      const t = step / 24;
      const bezierPoint = this.sampleCubicBezier(t, start, controlStart, controlEnd, end);
      const dx = point.x - bezierPoint.x;
      const dy = point.y - bezierPoint.y;
      minDistance = Math.min(minDistance, Math.hypot(dx, dy));
    }

    return minDistance;
  }

  private sampleCubicBezier(
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number }
  ): { x: number; y: number } {
    const oneMinusT = 1 - t;
    const x =
      oneMinusT ** 3 * p0.x +
      3 * oneMinusT ** 2 * t * p1.x +
      3 * oneMinusT * t ** 2 * p2.x +
      t ** 3 * p3.x;
    const y =
      oneMinusT ** 3 * p0.y +
      3 * oneMinusT ** 2 * t * p1.y +
      3 * oneMinusT * t ** 2 * p2.y +
      t ** 3 * p3.y;

    return { x, y };
  }
}

