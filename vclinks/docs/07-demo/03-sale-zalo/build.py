import json, os, subprocess, re
# Run from this folder: python3 build.py  (reads work/shots, writes work/out)
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(os.path.join(HERE, 'work'))
exec(open(os.path.join(HERE, 'scenes.py')).read())
os.makedirs('out/img', exist_ok=True); os.makedirs('out/audio', exist_ok=True); os.makedirs('tts', exist_ok=True)
sizes = {}
for s in S:
    b = s['board']
    if not b: continue
    if b not in sizes:
        out = subprocess.run(['sips','-g','pixelWidth','-g','pixelHeight',f'shots/{b}.png'],capture_output=True,text=True).stdout
        w = int(re.search(r'pixelWidth: (\d+)',out).group(1)); h = int(re.search(r'pixelHeight: (\d+)',out).group(1))
        sizes[b] = [w, h]
        if not os.path.exists(f'out/img/{b}.jpg'):
            subprocess.run(['ffmpeg','-loglevel','error','-y','-i',f'shots/{b}.png','-q:v','4',f'out/img/{b}.jpg'],check=True)
    w, h = sizes[b]
    if s['view'] is None:
        if h <= 1110 or not s['box']: s['view'] = [0, 0, w, min(h, 1110) if h > 1110 else h]
        else:
            x, y, bw, bh = s['box']; vh = max(900, bh + 260)
            y0 = max(0, min(h - vh, y - (vh - bh) // 2)); s['view'] = [0, y0, w, vh]
def speech(t):
    t = t.replace('′', ' phút').replace('–', ', ').replace('Ctrl K', 'Control K').replace('Ctrl Enter', 'Control Enter')
    t = t.replace('VClinks', 'Vi Xi links').replace('VCsales', 'Vi Xi sales').replace('VCparts', 'Vi Xi parts').replace('SLA', 'ét eo ây').replace('OE', 'ô e').replace('PDF', 'pi đi ép').replace('IndexedDB', 'index đi bi').replace('MongoDB', 'mông gô đi bi').replace('D9', 'đê chín').replace('Admin', 'át min').replace('Zalo', 'Da lô')
    return t
jobs = []
for k, s in enumerate(S, 1):
    n = f'{k:03d}'
    txt = speech(s['sub'])
    open(f'tts/{n}.txt','w').write(txt)
    if not os.path.exists(f'out/audio/{n}.mp3'): jobs.append(n)
open('tts/jobs.txt','w').write('\n'.join(jobs))
scenes = [{k: v for k, v in s.items() if v is not None} for s in S]
html = open(os.path.join(HERE, 'player.html')).read().replace('/*SCENES*/[]', json.dumps(scenes, ensure_ascii=False)).replace('/*IMGSIZES*/{}', json.dumps(sizes))
open('out/index.html','w').write(html)
print(len(S), 'scenes,', len(jobs), 'audio jobs,', len(sizes), 'images')
