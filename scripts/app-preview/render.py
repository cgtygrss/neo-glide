"""Render a reproducible App Store preview from native device captures."""
from pathlib import Path
import json, subprocess, hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'release/1.2.1/app-preview'
SOURCE=OUT/'source'

def run(args):
    subprocess.run(args,check=True)

def probe(file):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(file)]))

def render():
    edl=json.loads((OUT/'edit.json').read_text())
    work=OUT/'render';work.mkdir(exist_ok=True)
    for i,shot in enumerate(edl['shots']):
        # libx264 High@4.0 + progressive 30 fps, square pixels, no hardware mask.
        # A one-pixel aspect rounding is padded; no gameplay/UI is cropped.
        vf='scale=1920:886:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:886:(ow-iw)/2:(oh-ih)/2:color=0x0b1725,setsar=1,fps=30,format=yuv420p'
        if i==0:vf+=',fade=t=in:st=0:d=0.2'
        if i==len(edl['shots'])-1:vf+=f",fade=t=out:st={shot['duration']-.4}:d=0.4"
        run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(shot['start']),'-i',str(SOURCE/shot['source']),'-t',str(shot['duration']),'-an','-vf',vf,'-c:v','libx264','-preset','medium','-profile:v','high','-level:v','4.0','-b:v','11M','-maxrate','12M','-bufsize','24M','-pix_fmt','yuv420p','-video_track_timescale','30000',str(work/f'{i:02}.mp4')])
    (work/'concat.txt').write_text(''.join(f"file '{i:02}.mp4'\n" for i in range(len(edl['shots']))))
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(work/'concat.txt'),'-c','copy',str(work/'picture.mp4')])
    args=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(work/'picture.mp4'),'-i',str(SOURCE/'original-soundtrack.m4a')]
    for caption in edl['captions']:args+=['-loop','1','-i',str(SOURCE/caption['image'])]
    filters=[];previous='0:v'
    for i,caption in enumerate(edl['captions']):
        label=f'caption{i}'
        filters.append(f"[{previous}][{i+2}:v]overlay=0:0:enable='between(t,{caption['start']},{caption['end']})'[{label}]")
        previous=label
    args+=['-filter_complex',';'.join(filters),'-map',f'[{previous}]','-map','1:a','-t','28','-r','30','-c:v','libx264','-preset','slow','-profile:v','high','-level:v','4.0','-b:v','11M','-maxrate','12M','-bufsize','24M','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-c:a','aac','-b:a','256k','-ar','48000','-ac','2','-movflags','+faststart',str(OUT/'neo-glide-app-preview-iphone-en-GB.mp4')]
    run(args)
    final=OUT/'neo-glide-app-preview-iphone-en-GB.mp4'
    data=probe(final);video=next(s for s in data['streams'] if s['codec_type']=='video');audio=next(s for s in data['streams'] if s['codec_type']=='audio')
    checks={'duration_15_to_30':15<=float(data['format']['duration'])<=30,'iphone_resolution':(video['width'],video['height'])==(1920,886),'h264':video['codec_name']=='h264','high_at_most_4_0':video['profile']=='High' and video['level']<=40,'progressive':video['field_order']=='progressive','30fps':video['r_frame_rate']=='30/1','yuv420p':video['pix_fmt']=='yuv420p','aac_stereo':audio['codec_name']=='aac' and audio['channels']==2,'sample_rate':audio['sample_rate'] in ['44100','48000'],'under_500mb':final.stat().st_size<500_000_000}
    report={'file':final.name,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'bytes':final.stat().st_size,'checks':checks,'ffprobe':data}
    (OUT/'validation.json').write_text(json.dumps(report,indent=2))
    assert all(checks.values()),checks
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss','5','-i',str(final),'-frames:v','1',str(OUT/'poster-5s.jpg')])
    print(json.dumps({k:v for k,v in report.items() if k!='ffprobe'},indent=2))

if __name__=='__main__':render()
