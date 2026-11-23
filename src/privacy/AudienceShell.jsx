import { lazy, Suspense } from 'react';
import './Privacy.css';

// Unknown-age players start locally. Account, ads and purchase entry points
// still require an adult choice; loading the game never grants that access.
const StartupShell = lazy(() => import('../components/StartupShell.jsx'));
export default function AudienceShell() {
  return <Suspense fallback={<main className="privacy-loading" role="status">Opening Neo Glide…</main>}><StartupShell/></Suspense>;
}
