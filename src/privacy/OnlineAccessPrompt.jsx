import { useEffect, useRef, useState } from 'react';
import { chooseAudience } from './AudiencePolicy.js';
import LegalPanel from './LegalPanel.jsx';
import './Privacy.css';

export default function OnlineAccessPrompt({ onComplete, onCancel }) {
  const [error, setError] = useState('');
  const [document, setDocument] = useState(null);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [document]);
  const choose = group => {
    try { chooseAudience(group); onComplete(group); }
    catch (e) { setError(e.message); }
  };
  if (document) return <LegalPanel document={document} onClose={() => setDocument(null)}/>;
  return <section className="online-access-prompt" aria-labelledby="online-access-title">
    <h3 ref={heading} tabIndex={-1} id="online-access-title">Connect your pilot</h3>
    <p>Choose an age range to continue. Your choice stays on this device; no birthday is collected.</p>
    <div className="online-age-options" role="group" aria-label="Age group">
      <button type="button" onClick={() => choose('under13')}>Under 13</button>
      <button type="button" onClick={() => choose('13to17')}>13–17</button>
      <button type="button" onClick={() => choose('adult')}>18 or older</button>
    </div>
    <p>Under 18 or prefer not to say? Play locally. Adults can enable accounts and cloud saves, with optional ads and purchases.</p>
    <div className="online-access-links"><button type="button" onClick={onCancel}>Keep playing locally</button><button type="button" onClick={() => setDocument('privacy')}>Privacy policy</button></div>
    {error && <p role="alert">{error}</p>}
  </section>;
}
