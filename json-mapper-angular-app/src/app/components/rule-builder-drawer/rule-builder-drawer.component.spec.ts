import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuleBuilderDrawerComponent } from './rule-builder-drawer.component';

describe('RuleBuilderDrawerComponent', () => {
  let component: RuleBuilderDrawerComponent;
  let fixture: ComponentFixture<RuleBuilderDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RuleBuilderDrawerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(RuleBuilderDrawerComponent);
    component = fixture.componentInstance;
    component.operators = ['==', 'contains'];
    component.sourceOptions = [
      {
        id: 'src',
        scope: 'source',
        key: 'ramo',
        label: 'ramo',
        path: '$.dadosApolice.ramo',
        aliasPath: 'dadosApolice.ramo',
        displayPath: 'dadosApolice.ramo',
        kind: 'field',
        type: 'integer',
        parentId: 'root',
        children: [],
        expanded: true,
        manual: false,
        itemModel: false
      }
    ];
    component.targetOptions = [
      {
        id: 'tgt',
        scope: 'target',
        key: 'estado',
        label: 'estado',
        path: '$.data.estado',
        aliasPath: 'data.estado',
        displayPath: 'data.estado',
        kind: 'field',
        type: 'string',
        parentId: 'root',
        children: [],
        expanded: true,
        manual: false,
        itemModel: false
      }
    ];
    component.rules = [
      {
        id: 'rule-1',
        name: 'Gerador Porto',
        matchMode: 'all',
        conditions: [{ id: 'cond-1', scope: 'source', fieldPath: '$.dadosApolice.ramo', operator: '==', value: '5' }],
        actions: [
          {
            id: 'act-1',
            scope: 'target',
            fieldPath: '$.data.estado',
            type: 'setLiteral',
            value: 'SP',
            sourceScope: 'source',
            sourceFieldPath: '',
            expression: ''
          }
        ]
      }
    ];
    fixture.detectChanges();
  });

  it('renders existing rules', () => {
    const element = fixture.nativeElement as HTMLElement;
    const nameInput = element.querySelector('input') as HTMLInputElement;

    expect(nameInput.value).toBe('Gerador Porto');
    expect(element.textContent).toContain('Regras visuais do campo');
    expect(element.textContent).toContain('Então');
    expect(element.textContent).toContain('Condições configuradas');
    expect(element.textContent).toContain('Ações configuradas');
  });

  it('emits create and remove actions', () => {
    spyOn(component.createRule, 'emit');
    spyOn(component.removeRule, 'emit');
    spyOn(component.createRuleTemplate, 'emit');

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('Nova regra visual'))?.click();
    buttons.find((button) => button.textContent?.includes('Template Porto'))?.click();
    buttons.find((button) => button.textContent?.includes('Excluir'))?.click();

    expect(component.createRule.emit).toHaveBeenCalled();
    expect(component.createRuleTemplate.emit).toHaveBeenCalledWith('porto');
    expect(component.removeRule.emit).toHaveBeenCalledWith('rule-1');
  });

  it('emits preset patches for conditions and actions', () => {
    spyOn(component.updateCondition, 'emit');
    spyOn(component.updateAction, 'emit');

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.includes('ramo = 5'))?.click();
    buttons.find((button) => button.textContent?.trim() == 'Porto')?.click();

    expect(component.updateCondition.emit).toHaveBeenCalledWith({
      ruleId: 'rule-1',
      conditionId: 'cond-1',
      patch: {
        scope: 'source',
        fieldPath: '$.dadosApolice.ramo',
        operator: '==',
        value: '5'
      }
    });
    expect(component.updateAction.emit).toHaveBeenCalledWith({
      ruleId: 'rule-1',
      actionId: 'act-1',
      patch: {
        type: 'setLiteral',
        value: 'Porto'
      }
    });
  });
});
