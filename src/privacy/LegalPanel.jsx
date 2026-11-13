import { useEffect, useRef } from 'react';
import { onlineServicesAllowed } from './AudiencePolicy.js';
import './Privacy.css';

const titles = { privacy: 'Privacy policy', support: 'Support & parents', 'delete-account': 'Delete an account', notices: 'Third-party licenses' };
export default function LegalPanel({ document = 'privacy', onClose }) {
  const close = useRef(null);
  useEffect(() => { close.current?.focus(); }, []);
  const file = Object.hasOwn(titles, document) ? document : 'privacy';
  const base = import.meta.env?.BASE_URL || '/';
  // Family copies contain no clickable external URLs, forms, scripts or assets.
  const directory = onlineServicesAllowed() ? 'legal' : 'legal/family';
  return <section className="legal-screen" aria-label={titles[file]}>
    <header><h1>{titles[file]}</h1><button ref={close} onClick={onClose} aria-label="Close legal document">Back</button></header>
    <iframe title={titles[file]} src={`${base}${directory}/${file}.html`} sandbox=""/>
  </section>;
}
