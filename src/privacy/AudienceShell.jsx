import { lazy, Suspense, useState } from 'react';
import { chooseAudience, readAudience } from './AudiencePolicy.js';
import LegalPanel from './LegalPanel.jsx';
import './Privacy.css';

// No game/account/Firebase module is evaluated before this local choice.
const StartupShell = lazy(() => import('../components/StartupShell.jsx'));
export default function AudienceShell() {
  const [group, setGroup] = useState(readAudience);
  const [localOnly, setLocalOnly] = useState(false);
  const [error, setError] = useState('');
  const [document, setDocument] = useState(null);
  const choose = value => {
    try { setGroup(chooseAudience(value)); }
    catch (e) { setError(e.message); }
  };
  if (document) return <LegalPanel document={document} onClose={() => setDocument(null)}/>;
  if (group || localOnly) return <Suspense fallback={<main className="privacy-loading" role="status">Opening Neo Glide…</main>}><StartupShell/></Suspense>;
  return <main className="age-screen">
    <section className="age-card" aria-labelledby="age-title">
      <span className="age-brand">NEO GLIDE</span>
      <h1 id="age-title">Choose your age group</h1>
      <p>This choice stays on this device. We do not ask for your birthday or send your age group to a server.</p>
      <div className="age-options" role="group" aria-label="Age group">
        <button onClick={() => choose('under13')}>Under 13</button>
        <button onClick={() => choose('13to17')}>13–17</button>
        <button onClick={() => choose('adult')}>18 or older</button>
      </div>
      <button className="age-local" onClick={() => setLocalOnly(true)}>Continue without choosing</button>
      <p className="age-note">Under 18 or prefer not to say? Play stays on this device, without ads, accounts, cloud services or real-money purchases. For adults, online mode restores or creates an account and saves progress to the cloud. Ads and purchases are optional. See the privacy policy.</p>
      <div className="age-documents"><button onClick={() => setDocument('privacy')}>Privacy policy</button><button onClick={() => setDocument('support')}>For parents & support</button></div>
      {error && <p role="alert">{error}</p>}
    </section>
  </main>;
}
