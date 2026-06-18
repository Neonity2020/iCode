import { RightPanel } from './components/RightPanel'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'

export default function App() {
  return <div className="app-shell"><Sidebar /><section className="workspace"><Toolbar /><div className="work-area"><Timeline /><RightPanel /></div></section></div>
}
