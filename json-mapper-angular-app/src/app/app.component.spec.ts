import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MapperFacadeService } from '@app/services/mapper-facade.service';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let httpMock: HttpTestingController;

  const flushEventTypes = () => {
    const request = httpMock.expectOne((req) =>
      req.url == 'http://localhost:8080/api/eventos' &&
      req.params.get('page') == '1' &&
      req.params.get('size') == '100'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Emissao',
          description: 'Evento de emissao',
          active: true,
          createdAt: '2026-03-30T10:00:00Z',
          updatedAt: '2026-03-30T10:00:00Z'
        }
      ],
      totalItems: 1,
      totalPages: 1,
      size: 100,
      page: 1,
      hasNext: false,
      hasPrevious: false
    });
  };

  const seedSampleSchemas = (app: AppComponent) => {
    app.facade.updateSourceJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          dadosApolice: {
            type: 'object',
            properties: {
              codigoSucursal: { type: 'integer' },
              numeroApolice: { type: 'integer' },
              ramo: { type: 'integer' }
            }
          }
        }
      })
    );
    app.facade.updateTargetJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              contrato: {
                type: 'object',
                properties: {
                  numero: { type: 'string' }
                }
              }
            }
          }
        }
      })
    );
    app.facade.importSourceSchema();
    app.facade.importTargetSchema();
    const target = app.facade.targetLeafOptions().find((node) => node.displayPath === 'data.contrato.numero')!;
    app.facade.selectTargetNode(target.id);
    app.facade.setSelectedAliasSource('$.dadosApolice.codigoSucursal');
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match((req) => req.url == 'http://localhost:8080/api/eventos').forEach((request) =>
      request.flush({
        items: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Emissao',
            description: 'Evento de emissao',
            active: true,
            createdAt: '2026-03-30T10:00:00Z',
            updatedAt: '2026-03-30T10:00:00Z'
          }
        ],
        totalItems: 1,
        totalPages: 1,
        size: 100,
        page: 1,
        hasNext: false,
        hasPrevious: false
      })
    );
    httpMock.verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should start with empty builders and no visual generators', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    flushEventTypes();
    fixture.detectChanges();
    const app = fixture.componentInstance;
    expect(app.facade.sourceLeafOptions().length).toBe(0);
    expect(app.facade.targetLeafOptions().length).toBe(0);
    expect(app.facade.rules().length).toBe(0);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="rule-builder"]')).toBeFalsy();
  });

  it('should render the workspace title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    flushEventTypes();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Mapeador visual de schemas JSON');
  });

  it('should render labeled persistence metadata fields', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    flushEventTypes();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Codigo do parceiro');
    expect(compiled.textContent).toContain('Evento');
    expect(compiled.textContent).toContain('Tipo do schema');
    expect(compiled.textContent).toContain('Data inicio vigencia');
    expect(compiled.textContent).toContain('Versão');
  });

  it('should expose facade service', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.facade).toBe(TestBed.inject(MapperFacadeService));
  });

  it('should open and close the floating preview modal', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    flushEventTypes();
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('[data-testid="preview-fab"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(app.previewModalOpen).toBeTrue();
    expect(
      compiled.querySelector('[data-testid="preview-modal"], .preview-placeholder')
    ).toBeTruthy();

    app.closePreviewModal();
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(app.previewModalOpen).toBeFalse();
    expect(compiled.querySelector('[data-testid="preview-modal"]')).toBeFalsy();
  }));

  it('should search event types remotely as the user types', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    flushEventTypes();
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.onEventTypeSearchChange('sorte');
    tick(300);

    const request = httpMock.expectOne((req) =>
      req.url == 'http://localhost:8080/api/eventos' &&
      req.params.get('page') == '1' &&
      req.params.get('size') == '100' &&
      req.params.get('name') == 'sorte'
    );
    request.flush({
      items: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Sorteio de Brindes',
          description: 'Evento para distribuicao de brindes',
          active: true,
          createdAt: '2026-03-30T10:00:00Z',
          updatedAt: '2026-03-30T10:00:00Z'
        }
      ],
      totalItems: 1,
      totalPages: 1,
      size: 100,
      page: 1,
      hasNext: false,
      hasPrevious: false
    });

    expect(app.facade.eventTypes()[0]?.name).toBe('Sorteio de Brindes');
  }));

  it('should keep a visible link path for a selected mapped target', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    seedSampleSchemas(app);
    fixture.detectChanges();
    flushEventTypes();
    fixture.detectChanges();
    const mappedTarget = app.facade.mappedTargets()[0];

    app.facade.selectTargetNode(mappedTarget.targetNodeId);
    spyOn<any>(app, 'nodeAnchorPoint').and.returnValues(
      { x: 20, y: 40 },
      { x: 180, y: 110 }
    );

    const connections = app.workspaceConnections();
    expect(connections.length).toBeGreaterThan(0);
    expect(connections[0].path).toContain('M ');
  });

  it('should expose global drag line tones for append and overwrite states', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    flushEventTypes();
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.facade.updateSourceJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          dadosApolice: {
            type: 'object',
            properties: {
              codigoSucursal: { type: 'integer' },
              numeroApolice: { type: 'integer' }
            }
          }
        }
      })
    );
    app.facade.importSourceSchema();

    app.facade.updateTargetJsonText(
      JSON.stringify({
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              numero: { type: 'string' },
              tip: { type: 'string', default: 'APOLICE' }
            }
          }
        }
      })
    );
    app.facade.importTargetSchema();

    const numero = app.facade.targetLeafOptions().find((node) => node.displayPath == 'data.numero')!;
    const tip = app.facade.targetLeafOptions().find((node) => node.displayPath == 'data.tip')!;

    app.facade.selectTargetNode(numero.id);
    app.facade.setSelectedAliasSource('$.dadosApolice.codigoSucursal');
    app.facade.startDraggingSource('$.dadosApolice.numeroApolice');
    app.setHoveredTargetNode(numero.id);
    expect(app.workspaceLinkTone()).toBe('append');

    app.setHoveredTargetNode(tip.id);
    expect(app.workspaceLinkTone()).toBe('overwrite');
    expect(app.workspaceLinkLabel()).toBe('sobrescrevendo');
  });

  it('should keep multiple persistent lines for concat bindings on the selected target', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    seedSampleSchemas(app);
    fixture.detectChanges();

    const target = app.facade.targetLeafOptions().find((node) => node.displayPath === 'data.contrato.numero')!;
    app.facade.selectTargetNode(target.id);
    app.facade.setSelectedBindingMode('concat');
    app.facade.replaceConcatSource(0, '$.dadosApolice.codigoSucursal');
    app.facade.addConcatSource('$.dadosApolice.ramo');
    app.facade.addConcatSource('$.dadosApolice.numeroApolice');
    spyOn<any>(app, 'nodeAnchorPoint').and.callFake((attribute: string, value: string) => {
      if (attribute == 'data-node-id') {
        return { x: 210, y: 120 };
      }

      return value.includes('codigoSucursal')
        ? { x: 20, y: 40 }
        : value.includes('ramo')
          ? { x: 24, y: 80 }
          : { x: 28, y: 120 };
    });
    spyOn<any>(app, 'targetPortAnchorPoint').and.callFake((_targetId: string, index: number) => ({
      x: 190,
      y: 100 + index * 18
    }));

    const connections = app.workspaceConnections().filter((item) => item.kind === 'persistent');
    expect(connections.length).toBeGreaterThan(1);
    expect(connections.every((item) => item.tone === 'append')).toBeTrue();
  });

  it('should highlight only the hovered concat connection index', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    seedSampleSchemas(app);
    fixture.detectChanges();

    const target = app.facade.targetLeafOptions().find((node) => node.displayPath === 'data.contrato.numero')!;
    app.facade.selectTargetNode(target.id);
    app.facade.setSelectedBindingMode('concat');
    app.facade.replaceConcatSource(0, '$.dadosApolice.codigoSucursal');
    app.facade.addConcatSource('$.dadosApolice.ramo');
    app.facade.addConcatSource('$.dadosApolice.numeroApolice');
    spyOn<any>(app, 'nodeAnchorPoint').and.callFake((attribute: string, value: string) => {
      if (attribute == 'data-node-id') {
        return { x: 210, y: 120 };
      }

      return value.includes('codigoSucursal')
        ? { x: 20, y: 40 }
        : value.includes('ramo')
          ? { x: 24, y: 80 }
          : { x: 28, y: 120 };
    });
    spyOn<any>(app, 'targetPortAnchorPoint').and.callFake((_targetId: string, index: number) => ({
      x: 190,
      y: 100 + index * 18
    }));

    app.setHoveredConcatSegment(1);

    const connections = app.workspaceConnections().filter((item) => item.kind === 'persistent');
    expect(connections.filter((item) => item.highlighted).length).toBe(1);
    expect(connections.find((item) => item.portIndex === 1)?.highlighted).toBeTrue();
    expect(connections.some((item) => item.portIndex !== 1 && item.dimmed)).toBeTrue();
  });

  it('should expose overlay defaults and drag labels for every tone', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    expect(app.showWorkspaceLinkOverlay()).toBeFalse();
    expect(app.workspaceLinkViewBox()).toContain('0 0');
    expect(app.workspaceLinkLabel()).toBe('ligado');

    spyOn(app, 'workspaceLinkTone').and.returnValues('create', 'append', 'overwrite', 'noop', 'default');
    spyOn(app.facade, 'dragSourcePath').and.returnValue('$.dadosApolice.numeroApolice');
    expect(app.workspaceLinkLabel()).toBe('criando');
    expect(app.workspaceLinkLabel()).toBe('complementando');
    expect(app.workspaceLinkLabel()).toBe('sobrescrevendo');
    expect(app.workspaceLinkLabel()).toBe('ja ligado');
    expect(app.workspaceLinkLabel()).toBe('arrastando');
  });

  it('should track and clear workspace drag state', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    spyOn(app.facade, 'dragSourcePath').and.returnValue('$.dadosApolice.numeroApolice');

    app.trackWorkspaceDrag({ clientX: 120, clientY: 45 } as DragEvent);
    expect(app.dragPointer).toEqual({ x: 120, y: 45 });

    app.setHoveredTargetNode('target-1');
    expect(app.hoveredTargetNodeId).toBe('target-1');

    app.clearWorkspaceDrag();
    expect(app.dragPointer).toBeNull();
    expect(app.hoveredTargetNodeId).toBe('');
  });

  it('should ignore workspace drag tracking when no source is being dragged', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    spyOn(app.facade, 'dragSourcePath').and.returnValue('');

    app.trackWorkspaceDrag({ clientX: 9, clientY: 11 } as DragEvent);

    expect(app.dragPointer).toBeNull();
  });

  it('should manage hover state for concat segments and line hover detection', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.setHoveredConcatSegment(2);
    expect(app.hoveredConcatSegmentIndex()).toBe(2);

    spyOn<any>(app, 'closestPersistentConnection').and.returnValue({ portIndex: 1 });
    app.trackWorkspaceHover({ clientX: 10, clientY: 20 } as MouseEvent);
    expect(app.hoveredConcatSegmentIndex()).toBe(2);

    app.setHoveredConcatSegment(null);
    app.trackWorkspaceHover({ clientX: 10, clientY: 20 } as MouseEvent);
    expect(app.hoveredConcatSegmentIndex()).toBe(1);

    app.clearWorkspaceHover();
    expect(app.hoveredConcatSegmentIndex()).toBeNull();
  });

  it('should calculate label coordinates from drag endpoints and default to zero when absent', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    spyOn<any>(app, 'dragWorkspaceEndpoints').and.returnValue(null);
    expect(app.workspaceLinkLabelX()).toBe(0);
    expect(app.workspaceLinkLabelY()).toBe(0);

    (app['dragWorkspaceEndpoints'] as jasmine.Spy).and.returnValue({
      start: { x: 10, y: 20 },
      end: { x: 50, y: 80 }
    });
    expect(app.workspaceLinkLabelX()).toBe(30);
    expect(app.workspaceLinkLabelY()).toBeGreaterThan(0);
  });

  it('should sample cubic bezier geometry and closest connection helpers', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    const sample = app.sampleCubicBezier(
      0.5,
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
      { x: 30, y: 10 }
    );
    expect(sample.x).toBeGreaterThan(0);
    expect(sample.y).toBeGreaterThanOrEqual(0);

    const distance = app.distanceToBezier(
      { x: 10, y: 5 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
      { x: 30, y: 10 }
    );
    expect(distance).toBeGreaterThanOrEqual(0);

    spyOn(app, 'workspaceConnections').and.returnValue([
      {
        kind: 'persistent',
        start: { x: 0, y: 0 },
        controlStart: { x: 10, y: 0 },
        controlEnd: { x: 20, y: 10 },
        end: { x: 30, y: 10 },
        portIndex: 0
      }
    ]);
    const closest = app.closestPersistentConnection(10, 5);
    expect(closest.portIndex).toBe(0);
  });

  it('should cover hover reset, node lookup fallback and selected source fallback branches', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    seedSampleSchemas(app);

    app.explicitHoveredConcatSegmentIndex = null;
    spyOn(app, 'closestPersistentConnection').and.returnValue(null);
    app.trackWorkspaceHover({ clientX: 1, clientY: 2 } as MouseEvent);
    expect(app.hoveredConcatSegmentIndex()).toBeNull();

    expect(app.findTargetNode('')).toBeNull();

    const target = app.facade.targetLeafOptions().find((node: any) => node.displayPath === 'data.contrato.numero');
    target.binding.mode = 'alias';
    target.binding.sourcePaths = [''];
    app.facade.selectTargetNode(target.id);
    expect(app.selectedLinkedSourcePath()).toBe('');
  });

  it('should cover anchor and node anchor fallbacks when elements are outside viewport or missing', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    const element = document.createElement('div');
    const existingElementRectSpy = (element.getBoundingClientRect as any)?.and
      ? (element.getBoundingClientRect as jasmine.Spy)
      : null;
    const elementRectSpy = existingElementRectSpy ?? spyOn(element, 'getBoundingClientRect');
    elementRectSpy.and.returnValue({
      left: 10,
      right: 50,
      top: -100,
      bottom: -40,
      width: 40,
      height: 60,
      x: 10,
      y: -100,
      toJSON: () => ''
    } as DOMRect);
    const viewport = document.createElement('div');
    const existingViewportRectSpy = (viewport.getBoundingClientRect as any)?.and
      ? (viewport.getBoundingClientRect as jasmine.Spy)
      : null;
    const viewportRectSpy = existingViewportRectSpy ?? spyOn(viewport, 'getBoundingClientRect');
    viewportRectSpy.and.returnValue({
      left: 100,
      right: 300,
      top: 20,
      bottom: 220,
      width: 200,
      height: 200,
      x: 100,
      y: 20,
      toJSON: () => ''
    } as DOMRect);

    let point = app.anchorPoint(element, 'right', viewport);
    expect(point).toEqual(jasmine.objectContaining({ x: 300 }));

    elementRectSpy.and.returnValue({
      left: 10,
      right: 50,
      top: 40,
      bottom: 100,
      width: 40,
      height: 60,
      x: 10,
      y: 40,
      toJSON: () => ''
    } as DOMRect);
    point = app.anchorPoint(element, 'left', viewport);
    expect(point).toEqual(jasmine.objectContaining({ x: 100 }));

    app.builderGrid = { nativeElement: document.createElement('div') };
    expect(app.nodeAnchorPoint('data-node-id', 'missing', 'left')).toBeNull();
  });

  it('should cover drag endpoint and persistent connection fallbacks', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    seedSampleSchemas(app);

    const target = app.facade.targetLeafOptions().find((node: any) => node.displayPath === 'data.contrato.numero');
    app.facade.selectTargetNode(target.id);
    spyOn(app.facade, 'dragSourcePath').and.returnValue('$.dadosApolice.codigoSucursal');
    const existingNodeAnchorPointSpy = (app.nodeAnchorPoint as any)?.and
      ? (app.nodeAnchorPoint as jasmine.Spy)
      : null;
    const existingAnchorPointSpy = (app.anchorPoint as any)?.and
      ? (app.anchorPoint as jasmine.Spy)
      : null;
    const nodeAnchorPointSpy = existingNodeAnchorPointSpy ?? spyOn(app, 'nodeAnchorPoint');
    const anchorPointSpy = existingAnchorPointSpy ?? spyOn(app, 'anchorPoint');
    nodeAnchorPointSpy.and.returnValues(null, null);
    anchorPointSpy.and.returnValues(null, null);
    expect(app.dragWorkspaceEndpoints()).toBeNull();

    target.binding.mode = 'defaultSource';
    target.binding.defaultSourcePath = '$.dadosApolice.ramo';
    nodeAnchorPointSpy.and.returnValue(null);
    anchorPointSpy.and.returnValue(null);
    expect(app.persistentWorkspaceConnections()).toEqual([]);
    expect(app.persistentConnectionTone('defaultSource', 1)).toBe('create');
    expect(app.persistentConnectionTone('unmapped', 1)).toBe('default');
  });

  it('should prefer the nearest persistent connection and return null when all are far away', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    spyOn(app, 'workspaceConnections').and.returnValue([
      {
        kind: 'persistent',
        start: { x: 0, y: 0 },
        controlStart: { x: 10, y: 0 },
        controlEnd: { x: 20, y: 10 },
        end: { x: 30, y: 10 },
        portIndex: 0
      },
      {
        kind: 'persistent',
        start: { x: 0, y: 0 },
        controlStart: { x: 10, y: 0 },
        controlEnd: { x: 20, y: 10 },
        end: { x: 30, y: 10 },
        portIndex: 1
      }
    ]);
    spyOn(app, 'distanceToBezier').and.returnValues(12, 8, 40, 30);

    expect(app.closestPersistentConnection(10, 10)?.portIndex).toBe(1);
    expect(app.closestPersistentConnection(10, 10)).toBeNull();
  });

  it('should cover target drop effect branches and selected linked source path', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    seedSampleSchemas(app);

    spyOn(app.facade, 'dragSourcePath').and.returnValue('$.dadosApolice.codigoSucursal');

    const field = app.facade.targetLeafOptions().find((node: any) => node.displayPath === 'data.contrato.numero');
    expect(app.dropEffectForNode(field)).toBe('noop');

    field.binding.mode = 'concat';
    field.binding.sourcePaths = ['$.dadosApolice.ramo'];
    expect(app.dropEffectForNode(field)).toBe('append');

    field.binding.mode = 'defaultLiteral';
    expect(app.dropEffectForNode(field)).toBe('overwrite');

    field.binding.mode = 'defaultSource';
    field.binding.defaultSourcePath = '$.dadosApolice.ramo';
    app.facade.selectTargetNode(field.id);
    expect(app.selectedLinkedSourcePath()).toBe('$.dadosApolice.ramo');
    expect(app.activeWorkspaceSourcePath()).toBe('$.dadosApolice.codigoSucursal');
  });

  it('should use selected linked source path when no drag is active', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    seedSampleSchemas(app);
    const field = app.facade.targetLeafOptions().find((node: any) => node.displayPath === 'data.contrato.numero');
    field.binding.mode = 'alias';
    field.binding.sourcePaths = ['$.dadosApolice.ramo'];
    app.facade.selectTargetNode(field.id);
    spyOn(app.facade, 'dragSourcePath').and.returnValue('');

    expect(app.activeWorkspaceSourcePath()).toBe('$.dadosApolice.ramo');
  });

  it('should cover findTargetNode, drop effect create and default workspace tone', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    seedSampleSchemas(app);

    expect(app.findTargetNode('missing')).toBeNull();
    const dragSpy = spyOn(app.facade, 'dragSourcePath').and.returnValue('');
    expect(app.workspaceLinkTone()).toBe('default');

    const objectNode = app.facade.targetTree()[0].children[0];
    dragSpy.and.returnValue('$.dadosApolice.codigoSucursal');
    expect(app.dropEffectForNode(objectNode)).toBe('create');

    const emptyField = app.facade.targetLeafOptions()[0];
    emptyField.binding = { ...emptyField.binding!, mode: 'alias', sourcePaths: [], separator: '', formatters: [], defaultValue: '', defaultSourcePath: '', advancedExpression: '' };
    expect(app.dropEffectForNode(emptyField)).toBe('create');
  });

  it('should manage lifecycle hooks and overlay visibility', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const addSpy = jasmine.createSpy('addEventListener');
    const removeSpy = jasmine.createSpy('removeEventListener');
    app.builderGrid = {
      nativeElement: {
        addEventListener: addSpy,
        removeEventListener: removeSpy
      }
    };
    spyOn(app, 'refreshWorkspaceOverlay');

    app.ngAfterViewInit();
    await Promise.resolve();
    expect(addSpy).toHaveBeenCalled();
    expect(app.overlayReady).toBeTrue();
    expect(app.showWorkspaceLinkOverlay()).toBeFalse();

    app.onViewportChange();
    expect(app.refreshWorkspaceOverlay).toHaveBeenCalled();

    app.ngOnDestroy();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('should compute anchor points with viewport clamping and out-of-view fallback', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const viewport = document.createElement('div');
    viewport.className = 'tree-shell';
    spyOn(viewport, 'getBoundingClientRect').and.returnValue({
      top: 100,
      bottom: 300,
      left: 50,
      right: 250,
      width: 200,
      height: 200
    } as DOMRect);

    const element = document.createElement('div');
    viewport.appendChild(element);
    spyOn(element, 'closest').and.returnValue(viewport);
    spyOn(element, 'getBoundingClientRect').and.returnValues(
      { top: 140, bottom: 180, left: 70, right: 170, width: 100, height: 40 } as DOMRect,
      { top: 20, bottom: 60, left: 70, right: 170, width: 100, height: 40 } as DOMRect
    );

    const visiblePoint = app.anchorPoint(element, 'right', viewport);
    expect(visiblePoint.x).toBe(170);
    expect(visiblePoint.y).toBeGreaterThanOrEqual(118);

    const outOfViewPoint = app.anchorPoint(element, 'left', viewport);
    expect(outOfViewPoint.x).toBe(50);
    expect(outOfViewPoint.y).toBe(118);
  });

  it('should resolve node anchor points and visibility viewport helpers', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const viewport = document.createElement('div');
    viewport.className = 'tree-shell';
    const matched = document.createElement('div');
    viewport.appendChild(matched);
    spyOn(matched, 'closest').and.returnValue(viewport);
    spyOn(matched, 'getBoundingClientRect').and.returnValue({
      top: 120,
      bottom: 160,
      left: 80,
      right: 180,
      width: 100,
      height: 40
    } as DOMRect);
    spyOn(viewport, 'getBoundingClientRect').and.returnValue({
      top: 100,
      bottom: 300,
      left: 50,
      right: 250,
      width: 200,
      height: 200
    } as DOMRect);

    app.builderGrid = {
      nativeElement: {
        querySelector: jasmine.createSpy('querySelector').and.returnValue(matched),
        removeEventListener: jasmine.createSpy('removeEventListener')
      }
    };
    app.sourceColumn = { nativeElement: viewport };
    expect(app.visibilityViewport(matched)).toBe(viewport);
    expect(app.nodeAnchorPoint('data-source-path', '$.a', 'right').x).toBe(180);
    expect(app.nodeAnchorPoint('data-node-id', '', 'left')).toBeNull();
  });

  it('should build drag endpoints using node anchors and fallback columns', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    seedSampleSchemas(app);
    app.sourceColumn = { nativeElement: document.createElement('div') };
    app.targetColumn = { nativeElement: document.createElement('div') };

    spyOn(app.facade, 'dragSourcePath').and.returnValue('$.dadosApolice.codigoSucursal');
    spyOn(app.facade, 'selectedTargetNodeId').and.returnValue('target-1');
    spyOn(app, 'nodeAnchorPoint').and.returnValues(
      { x: 10, y: 20 },
      { x: 100, y: 200 }
    );
    let endpoints = app.dragWorkspaceEndpoints();
    expect(endpoints).toEqual({ start: { x: 10, y: 20 }, end: { x: 100, y: 200 } });

    app.dragPointer = { x: 300, y: 350 };
    endpoints = app.dragWorkspaceEndpoints();
    expect(endpoints.end).toEqual({ x: 300, y: 350 });

    (app.facade.dragSourcePath as jasmine.Spy).and.returnValue('');
    expect(app.dragWorkspaceEndpoints()).toBeNull();
  });

  it('should build persistent workspace connections with port anchors and hover state', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    seedSampleSchemas(app);
    const field = app.facade.targetLeafOptions().find((node: any) => node.displayPath === 'data.contrato.numero');
    field.binding.mode = 'concat';
    field.binding.sourcePaths = ['$.dadosApolice.codigoSucursal', '$.dadosApolice.ramo'];
    app.facade.selectTargetNode(field.id);
    app.setHoveredConcatSegment(1);

    spyOn(app, 'nodeAnchorPoint').and.callFake((attribute: string, value: string) => {
      if (attribute == 'data-node-id') {
        return { x: 200, y: 120 };
      }
      return value.includes('codigoSucursal') ? { x: 20, y: 40 } : { x: 30, y: 90 };
    });
    spyOn(app, 'targetPortAnchorPoint').and.callFake((_targetId: string, index: number) => ({ x: 180, y: 100 + index * 20 }));

    const connections = app.persistentWorkspaceConnections();
    expect(connections.length).toBe(2);
    expect(connections[1].highlighted).toBeTrue();
    expect(connections[0].dimmed).toBeTrue();
    expect(connections.every((item: any) => item.tone === 'append')).toBeTrue();
  });

  it('should return no persistent connections when selected target is not linkable', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    spyOn(app.facade, 'selectedTargetNode').and.returnValues(null, { kind: 'object', binding: undefined });
    expect(app.persistentWorkspaceConnections()).toEqual([]);
    expect(app.persistentWorkspaceConnections()).toEqual([]);
  });

  it('should cover connection geometry helpers and persistent tone variants', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;

    const geometry = app.buildConnectionGeometry({ x: 10, y: 20 }, { x: 150, y: 80 });
    expect(geometry.path).toContain('C');
    expect(app.connectionSpreadOffset(0, 1)).toBe(0);
    expect(app.connectionSpreadOffset(4, 5)).toBeGreaterThan(0);
    expect(app.persistentConnectionTone('concat', 2)).toBe('append');
    expect(app.persistentConnectionTone('defaultSource', 1)).toBe('create');
    expect(app.persistentConnectionTone('alias', 1)).toBe('default');
  });

  it('should resolve target port anchor points and return null when grid misses', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance as any;
    const matched = document.createElement('div');
    spyOn(app, 'anchorPoint').and.returnValue({ x: 111, y: 222 });
    app.builderGrid = {
      nativeElement: {
        querySelector: jasmine.createSpy('querySelector').and.returnValues(matched, null),
        removeEventListener: jasmine.createSpy('removeEventListener')
      }
    };
    app.targetColumn = { nativeElement: document.createElement('div') };

    expect(app.targetPortAnchorPoint('node-1', 0)).toEqual({ x: 111, y: 222 });
    expect(app.targetPortAnchorPoint('node-1', 1)).toBeNull();
  });
});
