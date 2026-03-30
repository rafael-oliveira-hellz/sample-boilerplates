import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SchemaGeneratorService } from '@app/services/schema-generator.service';
import { UI_TEXTS } from '../../content/ui-texts';
import { MappingRule, RuleAction, RuleActionApplicationMode, RuleOperator, SchemaNodeDraft } from '@models/mapper.models';

@Component({
  selector: 'app-rule-builder-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rule-builder-drawer.component.html',
  styleUrl: './rule-builder-drawer.component.scss'
})
export class RuleBuilderDrawerComponent {
  private readonly schemaGenerator = inject(SchemaGeneratorService);

  readonly actionApplicationModes: Array<{ value: RuleActionApplicationMode; label: string }> = [
    { value: 'replace', label: 'Substituir o campo' },
    { value: 'fallback', label: 'Usar como fallback' },
    { value: 'whenEmpty', label: 'Aplicar só quando vazio' }
  ];

  @Input({ required: true }) rules: MappingRule[] = [];
  @Input({ required: true }) operators: RuleOperator[] = [];
  @Input({ required: true }) sourceOptions: SchemaNodeDraft[] = [];
  @Input({ required: true }) targetOptions: SchemaNodeDraft[] = [];

  @Output() createRule = new EventEmitter<void>();
  @Output() updateRuleName = new EventEmitter<{ ruleId: string; value: string }>();
  @Output() updateRuleMatchMode = new EventEmitter<{ ruleId: string; mode: 'all' | 'any' }>();
  @Output() removeRule = new EventEmitter<string>();
  @Output() addCondition = new EventEmitter<string>();
  @Output() updateCondition = new EventEmitter<{
    ruleId: string;
    conditionId: string;
    patch: Record<string, unknown>;
  }>();
  @Output() removeCondition = new EventEmitter<{ ruleId: string; conditionId: string }>();
  @Output() addAction = new EventEmitter<string>();
  @Output() updateAction = new EventEmitter<{
    ruleId: string;
    actionId: string;
    patch: Record<string, unknown>;
  }>();
  @Output() removeAction = new EventEmitter<{ ruleId: string; actionId: string }>();
  @Output() createRuleTemplate = new EventEmitter<'porto' | 'apolice' | 'cnpjProdutor'>();

  readonly texts = UI_TEXTS.rules;

  applyConditionPreset(
    ruleId: string,
    conditionId: string,
    preset: {
      fieldPath: string;
      operator: RuleOperator;
      value: string;
    }
  ): void {
    this.updateCondition.emit({
      ruleId,
      conditionId,
      patch: {
        scope: 'source',
        fieldPath: preset.fieldPath,
        operator: preset.operator,
        value: preset.value
      }
    });
  }

  applyActionLiteralPreset(ruleId: string, actionId: string, value: string): void {
    this.updateAction.emit({
      ruleId,
      actionId,
      patch: {
        type: 'setLiteral',
        value
      }
    });
  }

  applyActionCopyPreset(ruleId: string, actionId: string, sourceFieldPath: string): void {
    this.updateAction.emit({
      ruleId,
      actionId,
      patch: {
        type: 'copyField',
        sourceScope: 'source',
        sourceFieldPath
      }
    });
  }

  totalConditions(): number {
    return this.rules.reduce((sum, rule) => sum + rule.conditions.length, 0);
  }

  totalActions(): number {
    return this.rules.reduce((sum, rule) => sum + rule.actions.length, 0);
  }

  conditionSummary(rule: MappingRule): string[] {
    return rule.conditions.map((condition) => {
      const field = this.displayPathForOption(condition.scope, condition.fieldPath);
      if (condition.operator == 'exists') {
        return `${field} existe`;
      }

      return `${field} ${condition.operator} ${condition.value?.trim() || '(vazio)'}`;
    });
  }

  actionSummary(rule: MappingRule): string[] {
    return rule.actions.map((action) => {
      const target = this.displayPathForOption(action.scope, action.fieldPath);
      const mode = this.actionApplicationLabel(action);

      if (action.type == 'setLiteral') {
        return `${target} ← ${action.value || '(vazio)'} · ${mode}`;
      }

      if (action.type == 'copyField') {
        return `${target} ← ${this.displayPathForOption(action.sourceScope, action.sourceFieldPath)} · ${mode}`;
      }

      return `${target} ← fórmula avançada · ${mode}`;
    });
  }

  targetNodeForAction(action: RuleAction): SchemaNodeDraft | null {
    if (action.scope != 'target') {
      return null;
    }

    return this.targetOptions.find((option) => option.path == action.fieldPath) ?? null;
  }

  actionCurrentBindingLabel(action: RuleAction): string {
    const targetNode = this.targetNodeForAction(action);
    const mode = targetNode?.binding?.mode;

    if (!targetNode || !mode || mode == 'unmapped') {
      return 'Sem preenchimento anterior no campo.';
    }

    const labels: Record<string, string> = {
      alias: 'Hoje o campo usa alias.',
      concat: 'Hoje o campo usa concat.',
      defaultLiteral: 'Hoje o campo usa default fixo.',
      defaultSource: 'Hoje o campo usa default da origem.',
      eval: 'Hoje o campo já usa eval.',
      script: 'Hoje o campo já usa script.'
    };

    return labels[mode] ?? 'Hoje o campo já possui uma configuração.';
  }

  actionApplicationLabel(action: RuleAction): string {
    const mode = action.applicationMode ?? 'replace';
    return this.actionApplicationModes.find((item) => item.value == mode)?.label ?? 'Substituir o campo';
  }

  actionOutputMode(rule: MappingRule, action: RuleAction): 'eval' | 'script' | 'indefinido' {
    const targetNode = this.targetNodeForAction(action);
    if (!targetNode) {
      return 'indefinido';
    }

    return this.schemaGenerator.previewRuleBinding(targetNode, [rule])?.mode ?? 'indefinido';
  }

  actionWillUseFallback(rule: MappingRule, action: RuleAction): boolean {
    const targetNode = this.targetNodeForAction(action);
    if (!targetNode?.binding || targetNode.binding.mode == 'unmapped') {
      return false;
    }

    return this.actionOutputMode(rule, action) != 'indefinido';
  }

  actionSchemaSummary(rule: MappingRule, action: RuleAction): string {
    const targetNode = this.targetNodeForAction(action);
    if (!targetNode) {
      return 'Essa ação ainda não aponta para um campo de saída válido.';
    }

    const mode = this.actionOutputMode(rule, action);
    if (mode == 'script') {
      return `Vai salvar como script no campo ${targetNode.displayPath}.`;
    }

    if (mode == 'eval') {
      return `Vai salvar como eval no campo ${targetNode.displayPath}.`;
    }

    return `O campo ${targetNode.displayPath} será atualizado no schema final.`;
  }

  actionImpactSummary(rule: MappingRule, action: RuleAction): string {
    if (action.scope != 'target') {
      return 'A ação está apontando para a entrada, então não gera preenchimento no payload final de saída.';
    }

    const targetNode = this.targetNodeForAction(action);
    if (!targetNode) {
      return 'Selecione um campo de saída para o sistema conseguir gravar essa regra no schema final.';
    }

    if ((action.applicationMode ?? 'replace') == 'fallback') {
      return 'A regra só entra quando o valor atual do campo estiver vazio ou não definido.';
    }

    if ((action.applicationMode ?? 'replace') == 'whenEmpty') {
      return 'A regra só preenche quando a condição for atendida e o campo atual estiver vazio.';
    }

    if (this.actionWillUseFallback(rule, action)) {
      return 'Quando a condição não for atendida, o sistema reaproveita a configuração atual do campo como fallback.';
    }

    return 'Quando a condição for atendida, essa regra preenche o campo diretamente.';
  }

  actionExpressionPreview(rule: MappingRule, action: RuleAction): string {
    const targetNode = this.targetNodeForAction(action);
    if (!targetNode) {
      return '';
    }

    return this.schemaGenerator.previewRuleBinding(targetNode, [rule])?.expression ?? '';
  }

  private displayPathForOption(scope: 'source' | 'target', path: string): string {
    const options = scope == 'source' ? this.sourceOptions : this.targetOptions;
    return options.find((option) => option.path == path)?.displayPath ?? path ?? 'campo não definido';
  }
}
