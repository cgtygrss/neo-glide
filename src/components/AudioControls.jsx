import React, { useId } from 'react';
import { Music2, Volume2 } from 'lucide-react';
import { normalizeSoundPreferences } from '../game/SoundPreferences';

export default function AudioControls({ preferences, onChange }) {
  const id = useId();
  const audio = normalizeSoundPreferences(preferences);
  return <>{[
    { key: 'music', title: 'Music', description: 'Flight soundtrack', volumeLabel: 'Music volume', icon: <Music2 size={20}/> },
    { key: 'sfx', title: 'Sound effects', description: 'Boosts, pickups & battles', volumeLabel: 'Effects volume', icon: <Volume2 size={20}/> },
  ].map(({ key, title, description, volumeLabel, icon }) => {
    const volumeKey = `${key}Volume`;
    const volume = Math.round(audio[volumeKey] * 100);
    const inputId = `${id}-${key}-volume`;
    return <React.Fragment key={key}>
      <button type="button" className="hangar-setting-switch" data-audio-channel={key} role="switch" aria-label={title} aria-checked={audio[key]} onClick={() => onChange?.(key, !audio[key])}>
        <span className="settings-row-icon">{icon}</span>
        <span className="settings-row-copy"><strong>{title}</strong><small>{description}</small></span>
        <span className="hangar-toggle" aria-hidden="true"><i/></span>
      </button>
      <label className="settings-volume-control" data-audio-channel={key} htmlFor={inputId}>
        <span>{volumeLabel}</span><output htmlFor={inputId}>{volume}%</output>
        <input id={inputId} type="range" min="0" max="100" step="1" value={volume} aria-valuetext={`${volume} percent`} onChange={event => onChange?.(volumeKey, Number(event.target.value) / 100)}/>
      </label>
    </React.Fragment>;
  })}</>;
}
