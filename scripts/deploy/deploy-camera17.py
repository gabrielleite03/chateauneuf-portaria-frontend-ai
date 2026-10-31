"""Deploy a versioned camera-view release, preserving all other services."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project', type=Path, required=True)
parser.add_argument('--release-dir', type=Path, required=True)
args = parser.parse_args()
project, release = args.project.resolve(), args.release_dir.resolve()
manifest = json.loads((release / 'release.json').read_text(encoding='utf-8-sig'))
version = manifest['version']
if not re.fullmatch(r'\d+(?:\.\d+)+', version):
    raise ValueError('Invalid version')
compose = ['docker', 'compose', '--env-file', '.env.docker']

def run(command):
    return subprocess.check_output(command, cwd=project, text=True, stderr=subprocess.PIPE)

def fetch(path):
    with urllib.request.urlopen('http://127.0.0.1:8081' + path, timeout=30) as response:
        return response.read()

for name in ('stream', 'frontend'):
    item = manifest[name]
    artifact = release / item['artifact']
    if artifact.parent != release or not item['image'].endswith(':' + version):
        raise ValueError('Invalid artifact or image')
    if hashlib.sha256(artifact.read_bytes()).hexdigest() != item['sha256']:
        raise ValueError('Artifact checksum mismatch')
    image = json.loads(run(['docker', 'image', 'inspect', item['image']]))[0]
    if image['Id'] != item['image_id']:
        raise ValueError('Image ID mismatch')
    if image['Config']['Labels']['org.opencontainers.image.revision'] != item['commit']:
        raise ValueError('Image source revision mismatch')

before = json.loads(run(compose + ['config', '--format', 'json']))
ids = {name: run(compose + ['ps', '-q', name]).strip()
       for name in before['services'] if name not in ('stream', 'frontend')}
if not all(ids.values()):
    raise RuntimeError('A required service is stopped')
backup = project / 'backups' / ('before-camera17-' + version)
backup.mkdir(mode=0o700, exist_ok=False)
env = project / '.env.docker'
overlay = project / 'docker-compose.camera17.yml'
shutil.copy2(env, backup / '.env.docker')
previous_overlay = overlay.read_bytes() if overlay.exists() else None
if previous_overlay is not None:
    (backup / overlay.name).write_bytes(previous_overlay)
(backup / 'images.json').write_text(json.dumps({name: value.get('image') for name, value in before['services'].items()}))
old = env.read_text()
updated = old
if overlay.name not in old:
    updated, count = re.subn(r'^(COMPOSE_FILE=.*)$', lambda match: match[1] + ':' + overlay.name, old, flags=re.M)
    if count != 1:
        raise ValueError('Expected COMPOSE_FILE setting')
try:
    overlay.write_text('services:\n  stream:\n    image: ' + manifest['stream']['image'] + '\n    env_file:\n      - ./secrets/camera17.env\n    ports:\n      - "50000-50031:50000-50031/udp"\n  frontend:\n    image: ' + manifest['frontend']['image'] + '\n')
    env.write_text(updated)
    after = json.loads(run(compose + ['config', '--format', 'json']))
    for name in before['services']:
        expected = before['services'][name]
        actual = json.loads(json.dumps(after['services'][name]))
        if name in ('stream', 'frontend'):
            actual['image'] = expected['image']
        if name == 'stream':
            actual['ports'] = expected.get('ports', [])
            actual['environment'].pop('CAMERA_17_RTSP_URL', None)
            expected = json.loads(json.dumps(expected))
            expected.get('environment', {}).pop('CAMERA_17_RTSP_URL', None)
        if actual != expected:
            raise RuntimeError('Unexpected configuration change: ' + name)
    run(compose + ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'stream', 'frontend'])
    for attempt in range(15):
        try:
            html = fetch('/').decode()
            bundle = fetch(re.search(r'src="(/assets/[^\"]+\.js)"', html).group(1)).decode()
            if not all(marker in bundle for marker in ('Guarita IP', version, manifest['frontend']['commit'])):
                raise RuntimeError('Missing release marker')
            break
        except Exception:
            if attempt == 14:
                raise
            time.sleep(2)
    checks = []
    for channel in (17, 12, 1):
        frame = fetch('/stream-api/api/camera/frame?channel=' + str(channel))
        if not frame.startswith(b'\xff\xd8') or not frame.endswith(b'\xff\xd9'):
            raise RuntimeError('Invalid JPEG for channel ' + str(channel))
        checks.append({'channel': channel, 'jpeg_bytes': len(frame)})
    with urllib.request.urlopen('http://127.0.0.1:8081/stream-api/api/camera/live?channel=17', timeout=25) as response:
        data = b''
        while data.count(b'\xff\xd9') < 3 and len(data) < 2000000:
            chunk = response.read(16384)
            if not chunk:
                break
            data += chunk
        if data.count(b'\xff\xd9') < 3:
            raise RuntimeError('Live feed did not deliver three complete frames')
    for name, identifier in ids.items():
        if run(compose + ['ps', '-q', name]).strip() != identifier:
            raise RuntimeError('Unrelated service restarted: ' + name)
    report = {'version': version, 'snapshots': checks, 'live_frames': data.count(b'\xff\xd9'),
              'other_services_unchanged': True, 'recording_enabled': False, 'backup': str(backup)}
    (release / 'deployment-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
except Exception:
    shutil.copy2(backup / '.env.docker', env)
    if previous_overlay is not None:
        overlay.write_bytes(previous_overlay)
    else:
        overlay.unlink(missing_ok=True)
    run(compose + ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'stream', 'frontend'])
    print('Deployment failed; previous frontend and stream restored.')
    raise
