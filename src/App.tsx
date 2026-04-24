import { useEffect } from 'react';
import { Workspace } from './components/Workspace';
import { useWorkspace } from './store/workspace';

export function App() {
  const init = useWorkspace((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return <Workspace />;
}
