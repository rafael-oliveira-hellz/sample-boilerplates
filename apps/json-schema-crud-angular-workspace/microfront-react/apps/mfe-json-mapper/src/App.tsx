import '@porto/shared-design-system/porto.css';
import './styles.css';
import { JsonMapperRewriteWorkspace } from './features/workspace/JsonMapperRewriteWorkspace';

export function App(): JSX.Element {
  return <JsonMapperRewriteWorkspace />;
}

export default App;
