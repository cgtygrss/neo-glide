"""Original procedural soundtrack and transparent caption artwork for the preview."""
from pathlib import Path
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'release/1.2.1/app-preview'
OUT.mkdir(parents=True, exist_ok=True)
SR, DUR = 48000, 28
mix = np.zeros((SR * DUR, 2), dtype=np.float64)
rng = np.random.default_rng(71)
def hz(midi): return 440 * 2 ** ((midi - 69) / 12)
def add(start, sound, volume=.1, pan=0):
    first = round(start * SR)
    if first >= len(mix): return
    sound = np.asarray(sound)[:len(mix)-first]
    mix[first:first+len(sound), 0] += sound * volume * np.sqrt((1-pan)/2)
    mix[first:first+len(sound), 1] += sound * volume * np.sqrt((1+pan)/2)
def tone(midi, length, bell=False):
    t = np.arange(round(length * SR)) / SR
    f = hz(midi)
    sound = np.sin(2*np.pi*f*t) + .22*np.sin(2*np.pi*f*2*t) + .08*np.sin(2*np.pi*f*3*t)
    env = np.minimum(t/.012,1)*np.exp(-t*(7 if bell else 2.8))*np.minimum((length-t)/.035,1)
    return sound * env
# Seven 4-beat bars at 120 bpm: Dm, Bb, F, C, Dm, Bb, Dm.
chords = [(50,53,57),(46,50,53),(48,53,57),(48,52,55),(50,53,57),(46,50,53),(50,53,57)]
for bar in range(14):
    chord = chords[bar//2]
    start = bar*2
    t = np.arange(2*SR)/SR
    pad = sum(np.sin(2*np.pi*hz(n+12)*t) + .3*np.sin(2*np.pi*hz(n+12)*1.003*t) for n in chord)/4
    env = np.minimum(t/.2,1)*np.minimum((2-t)/.3,1)
    add(start,pad*env,.075,(-1)**bar*.3)
    for eighth in range(8):
        pos = start + eighth*.25
        n = chord[[0,1,2,1,0,2,1,2][eighth]]+24
        add(pos,tone(n,.65,True),.11,(-1)**eighth*.55)
        add(pos+.13,tone(n,.65,True),.025,(-1)**(eighth+1)*.65)
        add(pos,tone(chord[0]-12+(12 if eighth%4==3 else 0),.21),.16)
        ht=np.arange(round(.075*SR))/SR
        noise=rng.normal(0,1,len(ht));noise=np.r_[0,np.diff(noise)]
        add(pos,noise*np.exp(-ht*80),.025 if eighth%2 else .04,(-1)**eighth*.25)
    for beat in range(4):
        pos=start+beat*.5
        t=np.arange(round(.27*SR))/SR
        kick=np.sin(2*np.pi*(46*t+7*(1-np.exp(-t*35))))*np.exp(-t*18)
        add(pos,kick,.37)
        if beat%2:
            t=np.arange(round(.14*SR))/SR
            snare=(rng.normal(0,1,len(t))*.6+np.sin(2*np.pi*180*t)*.2)*np.exp(-t*32)
            add(pos,snare,.075)
# Gentle reverb and a clean final cadence.
add(26,tone(74,2),.1,-.2)
for delay,level in [(0.111,.08),(.227,.055),(.373,.035)]:
    offset=round(delay*SR);mix[offset:] += mix[:-offset, ::-1]*level
fade=np.minimum(np.arange(len(mix))/SR/.35,1)*np.minimum((DUR-np.arange(len(mix))/SR)/1.4,1)
mix=np.tanh(mix*1.25)*fade[:,None]
mix*=.86/max(np.max(np.abs(mix)),1e-9)
with wave.open(str(OUT/'source/original-soundtrack.wav'),'wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((mix*32767).astype('<i2').tobytes())
font='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
regular='/System/Library/Fonts/Supplemental/Arial.ttf'
for name,heading,sub in [
    ('rhythm','FIND YOUR RHYTHM','Hold to rise. Release to glide.'),
    ('battle','DODGE. FIRE. KEEP FLYING.','Collect credits along the way.'),
    ('end','NEO GLIDE','How far can you fly?')]:
    im=Image.new('RGBA',(1920,886));d=ImageDraw.Draw(im)
    width=920 if name=='battle' else 790
    x=(1920-width)//2;y=724
    d.rounded_rectangle((x,y,x+width,y+126),radius=26,fill=(7,20,33,238),outline=(151,218,204,125),width=2)
    d.rounded_rectangle((x+26,y+30,x+31,y+96),radius=2,fill=(151,218,204,255))
    d.text((960,y+43),heading,font=ImageFont.truetype(font,36),fill=(239,247,244),anchor='mm')
    d.text((960,y+87),sub,font=ImageFont.truetype(regular,26),fill=(177,203,210),anchor='mm')
    im.save(OUT/f'source/caption-{name}.png')
print('Generated 28-second original stereo soundtrack and three captions.')
