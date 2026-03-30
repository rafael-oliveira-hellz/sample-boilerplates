import type { MappingRule, RuleAction, RuleCondition, RuleOperator, SchemaNodeDraft } from '../../core/models/mapperModels';
import { RULE_OPERATORS, actionApplicationLabel, ruleActionTypeLabel, summarizeAction, summarizeCondition } from './rulesState';

interface RulesPanelProps {
  rules: MappingRule[];
  sourceOptions: SchemaNodeDraft[];
  targetOptions: SchemaNodeDraft[];
  onCreateRule(): void;
  onRemoveRule(ruleId: string): void;
  onUpdateRuleName(ruleId: string, value: string): void;
  onUpdateRuleMatchMode(ruleId: string, mode: 'all' | 'any'): void;
  onAddCondition(ruleId: string): void;
  onRemoveCondition(ruleId: string, conditionId: string): void;
  onUpdateCondition(ruleId: string, conditionId: string, patch: Partial<RuleCondition>): void;
  onAddAction(ruleId: string): void;
  onRemoveAction(ruleId: string, actionId: string): void;
  onUpdateAction(ruleId: string, actionId: string, patch: Partial<RuleAction>): void;
  onCreateRuleTemplate(template: 'porto' | 'apolice' | 'cnpjProdutor'): void;
}

export function RulesPanel(props: RulesPanelProps): JSX.Element {
  const canUseRules = props.sourceOptions.length > 0 && props.targetOptions.length > 0;

  return (
    <section className="rewrite-panel rules-panel-react" data-testid="react-rules-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">ASSISTENTE VISUAL</p>
          <h3>Regras visuais do campo</h3>
          <p>Monte condições e ações de preenchimento sem escrever fórmulas longas. O preview React já considera esse impacto no schema final.</p>
        </div>
        {canUseRules ? <button type="button" onClick={props.onCreateRule}>Nova regra visual</button> : null}
      </div>

      {!canUseRules ? (
        <div className="empty-state-card">
          <strong>As regras dependem de origem e destino</strong>
          <p>Importe ou monte os dois lados primeiro para configurar regras com contratos válidos.</p>
        </div>
      ) : (
        <>
          <div className="template-actions">
            <button type="button" className="ghost" onClick={() => props.onCreateRuleTemplate('porto')}>Template Porto</button>
            <button type="button" className="ghost" onClick={() => props.onCreateRuleTemplate('apolice')}>Template APÓLICE</button>
            <button type="button" className="ghost" onClick={() => props.onCreateRuleTemplate('cnpjProdutor')}>Template CNPJ</button>
          </div>

          {props.rules.length === 0 ? (
            <div className="empty-state-card">
              <strong>Nenhuma regra visual ainda</strong>
              <p>Crie uma regra para declarar condições e transformar isso em `eval` ou `script` no schema de destino.</p>
            </div>
          ) : (
            <div className="rule-list-react">
              {props.rules.map((rule) => (
                <section key={rule.id} className="rule-card-react">
                  <div className="rule-top-react">
                    <input value={rule.name} onChange={(event) => props.onUpdateRuleName(rule.id, event.target.value)} placeholder="Nome da regra visual" />
                    <select value={rule.matchMode ?? 'all'} onChange={(event) => props.onUpdateRuleMatchMode(rule.id, event.target.value as 'all' | 'any')}>
                      <option value="all">Todas as condições (E)</option>
                      <option value="any">Qualquer condição (OU)</option>
                    </select>
                    <button type="button" className="danger-button" onClick={() => props.onRemoveRule(rule.id)}>Excluir</button>
                  </div>

                  <div className="summary-badges">
                    <span className="badge">{rule.conditions.length} condições</span>
                    <span className="badge">{rule.actions.length} ações</span>
                    <span className="badge">{(rule.matchMode ?? 'all') === 'all' ? 'E' : 'OU'}</span>
                  </div>

                  <div className="configured-grid">
                    <div className="configured-box">
                      <strong>Condições configuradas</strong>
                      <div className="token-list">
                        {rule.conditions.map((condition) => (
                          <span key={condition.id} className="token-chip">
                            {summarizeCondition(condition, labelForPath(condition.scope === 'source' ? props.sourceOptions : props.targetOptions, condition.fieldPath))}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="configured-box">
                      <strong>Ações configuradas</strong>
                      <div className="token-list">
                        {rule.actions.map((action) => (
                          <span key={action.id} className="token-chip">
                            {summarizeAction(
                              action,
                              labelForPath(action.scope === 'source' ? props.sourceOptions : props.targetOptions, action.fieldPath),
                              labelForPath(action.sourceScope === 'source' ? props.sourceOptions : props.targetOptions, action.sourceFieldPath)
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rules-grid">
                    <div className="inspector-section">
                      <div className="section-head">
                        <strong>Se</strong>
                      </div>
                      {rule.conditions.map((condition) => (
                        <div key={condition.id} className="rule-line-react">
                          <select value={condition.scope} onChange={(event) => props.onUpdateCondition(rule.id, condition.id, { scope: event.target.value as 'source' | 'target' })}>
                            <option value="source">Entrada</option>
                            <option value="target">Saída</option>
                          </select>
                          <select value={condition.fieldPath} onChange={(event) => props.onUpdateCondition(rule.id, condition.id, { fieldPath: event.target.value })}>
                            {(condition.scope === 'source' ? props.sourceOptions : props.targetOptions).map((option) => (
                              <option key={option.id} value={option.path}>{option.displayPath}</option>
                            ))}
                          </select>
                          <select value={condition.operator} onChange={(event) => props.onUpdateCondition(rule.id, condition.id, { operator: event.target.value as RuleOperator })}>
                            {RULE_OPERATORS.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                          </select>
                          <input value={condition.value} onChange={(event) => props.onUpdateCondition(rule.id, condition.id, { value: event.target.value })} placeholder="5, Porto, true..." />
                          <button type="button" className="ghost compact-button" onClick={() => props.onRemoveCondition(rule.id, condition.id)}>×</button>
                        </div>
                      ))}
                      <button type="button" className="ghost" onClick={() => props.onAddCondition(rule.id)}>+ Condição</button>
                    </div>

                    <div className="inspector-section">
                      <div className="section-head">
                        <strong>Então</strong>
                      </div>
                      {rule.actions.map((action) => (
                        <div key={action.id} className="action-card-react">
                          <div className="rule-line-react">
                            <select value={action.scope} onChange={(event) => props.onUpdateAction(rule.id, action.id, { scope: event.target.value as 'source' | 'target' })}>
                              <option value="target">Saída</option>
                              <option value="source">Entrada</option>
                            </select>
                            <select value={action.fieldPath} onChange={(event) => props.onUpdateAction(rule.id, action.id, { fieldPath: event.target.value })}>
                              {(action.scope === 'source' ? props.sourceOptions : props.targetOptions).map((option) => (
                                <option key={option.id} value={option.path}>{option.displayPath}</option>
                              ))}
                            </select>
                            <select value={action.type} onChange={(event) => props.onUpdateAction(rule.id, action.id, { type: event.target.value as RuleAction['type'] })}>
                              <option value="setLiteral">Definir valor</option>
                              <option value="copyField">Copiar campo</option>
                              <option value="setExpression">Fórmula avançada</option>
                            </select>
                            <select value={action.applicationMode ?? 'replace'} onChange={(event) => props.onUpdateAction(rule.id, action.id, { applicationMode: event.target.value as RuleAction['applicationMode'] })}>
                              <option value="replace">Substituir o campo</option>
                              <option value="fallback">Usar como fallback</option>
                              <option value="whenEmpty">Aplicar só quando vazio</option>
                            </select>
                            <button type="button" className="ghost compact-button" onClick={() => props.onRemoveAction(rule.id, action.id)}>×</button>
                          </div>

                          {action.type === 'setLiteral' ? (
                            <input value={action.value} onChange={(event) => props.onUpdateAction(rule.id, action.id, { value: event.target.value })} placeholder="Valor fixo" />
                          ) : null}

                          {action.type === 'copyField' ? (
                            <div className="rule-line-react compact">
                              <select value={action.sourceScope} onChange={(event) => props.onUpdateAction(rule.id, action.id, { sourceScope: event.target.value as 'source' | 'target' })}>
                                <option value="source">Entrada</option>
                                <option value="target">Saída</option>
                              </select>
                              <select value={action.sourceFieldPath} onChange={(event) => props.onUpdateAction(rule.id, action.id, { sourceFieldPath: event.target.value })}>
                                {(action.sourceScope === 'source' ? props.sourceOptions : props.targetOptions).map((option) => (
                                  <option key={option.id} value={option.path}>{option.displayPath}</option>
                                ))}
                              </select>
                            </div>
                          ) : null}

                          {action.type === 'setExpression' ? (
                            <textarea value={action.expression} onChange={(event) => props.onUpdateAction(rule.id, action.id, { expression: event.target.value })} placeholder="concat(src('$.dadosApolice.codigoSucursal'), '-', src('$.dadosApolice.numeroApolice'))" />
                          ) : null}

                          <div className="helper-copy">
                            <strong>{ruleActionTypeLabel(action.type)}</strong> · {actionApplicationLabel(action.applicationMode)}
                          </div>
                        </div>
                      ))}
                      <button type="button" className="ghost" onClick={() => props.onAddAction(rule.id)}>+ Ação</button>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function labelForPath(options: SchemaNodeDraft[], path: string): string {
  return options.find((option) => option.path === path)?.displayPath ?? path ?? 'campo não definido';
}
