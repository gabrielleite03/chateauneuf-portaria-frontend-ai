#!/usr/bin/env python3
"""Release frontend + image analyzer, preserving the existing backend and DVR stream."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import subprocess
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--release-dir', type=Path, required=True)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    project, release = args.project.resolve(), args.release_dir.resolve()
    manifest = json.loads((release / 'release.json').read_text(encoding='utf-8-sig'))
    version = manifest['version']
    if not re.fullmatch(r'\d+(?:\.\d+)+', version):
        raise ValueError('Invalid version')
    compose = ['docker', 'compose', '--env-file', '.env.docker']

    def run(command):
        return subprocess.check_output(command, cwd=project, text=True, stderr=subprocess.PIPE)

    def fetch(url, data=None, token=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None, headers=headers)
        with urllib.request.urlopen(req, timeout=40) as response:
            return response.read().decode()

    def retry(operation, timeout=180):
        deadline = time.monotonic() + timeout
        while True:
            try:
                return operation()
            except Exception:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(3)

    for name in ['frontend', 'analyzer', 'engine']:
        item = manifest[name]
        if name != 'engine' and not item['image'].endswith(':' + version):
            raise ValueError('Invalid image tag: ' + name)
        details = json.loads(run(['docker', 'image', 'inspect', item['image']]))[0]
        if 'archive' in item:
            archive = release / item['archive']
            if archive.parent != release or not re.fullmatch(r'sha256:[0-9a-f]{64}', item['image_id']):
                raise ValueError('Invalid image artifact: ' + name)
            checksum = hashlib.sha256()
            with archive.open('rb') as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    checksum.update(chunk)
            if checksum.hexdigest() != item['archive_sha256'] or details['Id'] != item['image_id']:
                raise ValueError('Image artifact mismatch: ' + name)
        else:
            if not re.fullmatch(r'sha256:[0-9a-f]{64}', item['digest']):
                raise ValueError('Invalid digest: ' + name)
            expected = item['image'].rsplit(':', 1)[0] + '@' + item['digest']
            if expected not in details.get('RepoDigests', []):
                raise ValueError('Image digest mismatch: ' + name)
    run(compose + ['config', '--quiet'])
    before_config = json.loads(run(compose + ['config', '--format', 'json']))
    before_ids = {s: run(compose + ['ps', '-q', s]).strip() for s in ['backend', 'stream', 'network-auth-service']}
    if not all(before_ids.values()):
        raise RuntimeError('Existing services are not running')
    base = 'http://127.0.0.1:8081'
    before_version = json.loads(fetch(base + '/api/version'))
    visits = json.loads(fetch(base + '/api/access-logs'))
    reservations = json.loads(fetch(base + '/api/reservations'))
    if args.check_only:
        print(json.dumps({'version': version, 'preflight': 'passed', 'changed': False}))
        return

    backup = project / 'backups' / ('before-detection-' + version)
    backup.mkdir(mode=0o700, parents=True, exist_ok=False)
    managed = ['.env.docker', 'docker-compose.detection.yml', 'detection-engine-settings.json']
    existed = {name: (project / name).exists() for name in managed}
    for name in managed:
        if existed[name]:
            shutil.copy2(project / name, backup / name)
    (backup / 'access-logs.json').write_text(json.dumps(visits))
    (backup / 'reservations.json').write_text(json.dumps(reservations))
    with sqlite3.connect((project / 'data/portaria.db').as_uri() + '?mode=ro', uri=True) as source:
        with sqlite3.connect(backup / 'portaria.db') as target:
            source.backup(target)
            if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Invalid database backup')
    old_env = (project / '.env.docker').read_text()
    key = secrets.token_urlsafe(32)
    files = ['docker-compose.yml']
    if (project / 'docker-compose.override.yml').exists():
        files.append('docker-compose.override.yml')
    files.append('docker-compose.detection.yml')
    updates = {
        'COMPOSE_FILE': ':'.join(files), 'FRONTEND_IMAGE': manifest['frontend']['image'],
        'ANALYZER_IMAGE': manifest['analyzer']['image'], 'PEOPLE_ENGINE_IMAGE': manifest['engine']['image'],
        'ANALYZER_API_KEY': key, 'ANALYZER_URL': 'http://image-analyzer:8090',
    }
    new_env = old_env
    for name, value in updates.items():
        new_env = re.sub(r'^' + name + r'=.*\n?', '', new_env, flags=re.M)
        new_env = new_env.rstrip() + '\n' + name + '=' + value + '\n'
    try:
        shutil.copy2(release / 'docker-compose.detection.yml', project / 'docker-compose.detection.yml')
        shutil.copy2(release / 'detection-engine-settings.json', project / 'detection-engine-settings.json')
        (project / '.env.docker').write_text(new_env)
        os.chmod(project / '.env.docker', 0o600)
        run(compose + ['config', '--quiet'])
        planned = json.loads(run(compose + ['config', '--format', 'json']))
        for service in before_ids:
            if before_config['services'][service] != planned['services'][service]:
                raise RuntimeError('Unexpected configuration change: ' + service)
        print('Starting inference services; existing frontend remains active', flush=True)
        run(compose + ['up', '-d', '--no-build', '--no-deps', '--pull', 'never', 'people-engine', 'image-analyzer'])
        analysis = retry(lambda: json.loads(fetch('http://127.0.0.1:8090/api/analysis', {'channel': 12}, key)), 240)
        if analysis.get('channel') != 12 or not isinstance(analysis.get('detections'), list):
            raise RuntimeError('Invalid real camera inference')
        analyzer_version = json.loads(fetch('http://127.0.0.1:8090/api/version'))
        if analyzer_version.get('version') != version or analyzer_version.get('commit') != manifest['analyzer']['commit']:
            raise RuntimeError('Analyzer version mismatch')
        print('Real DVR inference passed; switching frontend', flush=True)
        run(compose + ['up', '-d', '--no-build', '--no-deps', '--pull', 'never', 'frontend'])

        def validate_frontend():
            html = fetch(base)
            match = re.search(r'src="(/assets/[^\"]+\.js)"', html)
            bundle = fetch(base + match.group(1))
            for marker in [version, manifest['frontend']['commit'], 'Presença detectada', '/analyzer-api/api/analysis']:
                if marker not in bundle:
                    raise RuntimeError('Missing frontend release marker')
            result = json.loads(fetch(base + '/analyzer-api/api/analysis', {'channel': 12}))
            if result.get('channel') != 12 or not isinstance(result.get('detections'), list):
                raise RuntimeError('Frontend inference proxy failed')
            return result
        analysis = retry(validate_frontend, 90)
        if json.loads(fetch(base + '/api/version')) != before_version:
            raise RuntimeError('Backend version changed unexpectedly')
        after_visits = json.loads(fetch(base + '/api/access-logs'))
        after_reservations = json.loads(fetch(base + '/api/reservations'))
        if not {str(v['id']) for v in visits}.issubset({str(v['id']) for v in after_visits}):
            raise RuntimeError('Missing access records')
        if not {str(v['id']) for v in reservations}.issubset({str(v['id']) for v in after_reservations}):
            raise RuntimeError('Missing reservations')
        for service, identifier in before_ids.items():
            if run(compose + ['ps', '-q', service]).strip() != identifier:
                raise RuntimeError('Unexpected restart: ' + service)
        report = {'version': version, 'status': 'passed', 'deployed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'backend_unchanged': before_version, 'analyzer': analyzer_version, 'camera_channel': 12,
                  'people_detected': sum(d['kind'] == 'person' for d in analysis['detections']),
                  'visits_preserved': len(visits), 'reservations_preserved': len(reservations), 'backup': str(backup)}
        (release / 'deployment-report.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report), flush=True)
    except Exception:
        # Remove only services introduced by this release. Never restore the database.
        new_services = [s for s in ['image-analyzer', 'people-engine'] if s not in before_config['services']]
        if new_services:
            subprocess.run(compose + ['rm', '-s', '-f'] + new_services, cwd=project, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for name in managed:
            if existed[name]:
                shutil.copy2(backup / name, project / name)
            elif (project / name).exists():
                (project / name).unlink()
        run(compose + ['up', '-d', '--no-build', '--no-deps', '--pull', 'never', 'frontend'])
        (release / 'deployment-report.json').write_text(json.dumps({'version': version, 'status': 'rolled_back', 'backup': str(backup)}))
        raise


if __name__ == '__main__':
    main()
