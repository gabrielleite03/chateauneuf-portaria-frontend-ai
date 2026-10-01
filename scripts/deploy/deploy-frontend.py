#!/usr/bin/env python3
"""Deploy a checksummed frontend archive without restarting any other service."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
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
    version, item = manifest['version'], manifest['frontend']
    if not re.fullmatch(r'\d+(?:\.\d+)+', version) or not item['image'].endswith(':' + version):
        raise ValueError('Invalid release version/image')
    archive = release / item['archive']
    if archive.parent != release:
        raise ValueError('Invalid archive path')
    digest = hashlib.sha256()
    with archive.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != item['archive_sha256']:
        raise ValueError('Archive checksum mismatch')
    compose = ['docker', 'compose', '--env-file', '.env.docker']

    def run(command):
        return subprocess.check_output(command, cwd=project, text=True, stderr=subprocess.PIPE)

    def fetch(path):
        with urllib.request.urlopen('http://127.0.0.1:8081' + path, timeout=15) as response:
            return response.read().decode()

    image = json.loads(run(['docker', 'image', 'inspect', item['image']]))[0]
    if image['Id'] != item['image_id']:
        raise ValueError('Image ID mismatch')
    before = json.loads(run(compose + ['config', '--format', 'json']))
    ids = {name: run(compose + ['ps', '-q', name]).strip() for name in before['services'] if name != 'frontend'}
    if not all(ids.values()):
        raise RuntimeError('A required service is not running')
    visits = json.loads(fetch('/api/access-logs'))
    reservations = json.loads(fetch('/api/reservations'))
    if args.check_only:
        print(json.dumps({'version': version, 'preflight': 'passed', 'changed': False}))
        return
    backup = project / 'backups' / ('before-frontend-' + version)
    backup.mkdir(mode=0o700, parents=True, exist_ok=False)
    env_file = project / '.env.docker'
    shutil.copy2(env_file, backup / '.env.docker')
    with sqlite3.connect((project / 'data/portaria.db').as_uri() + '?mode=ro', uri=True) as source:
        with sqlite3.connect(backup / 'portaria.db') as target:
            source.backup(target)
            if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Invalid database backup')
    env_text, count = re.subn(r'^FRONTEND_IMAGE=.*$', lambda _: 'FRONTEND_IMAGE=' + item['image'], env_file.read_text(), flags=re.M)
    if count != 1:
        raise ValueError('Expected exactly one FRONTEND_IMAGE')
    try:
        env_file.write_text(env_text)
        planned = json.loads(run(compose + ['config', '--format', 'json']))
        expected = json.loads(json.dumps(before))
        expected['services']['frontend']['image'] = item['image']
        if planned != expected:
            raise RuntimeError('Unexpected configuration changes')
        run(compose + ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'frontend'])
        deadline = time.monotonic() + 90
        while True:
            try:
                html = fetch('/')
                bundle = fetch(re.search(r'src="(/assets/[^\"]+\.js)"', html).group(1))
                for marker in [version, item['commit']] + manifest['checks']['frontend_markers']:
                    if marker not in bundle:
                        raise RuntimeError('Missing frontend release marker')
                break
            except Exception:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(2)
        for name, identifier in ids.items():
            if run(compose + ['ps', '-q', name]).strip() != identifier:
                raise RuntimeError('Unexpected restart: ' + name)
        for path, old in [('/api/access-logs', visits), ('/api/reservations', reservations)]:
            current = json.loads(fetch(path))
            if not {str(row['id']) for row in old}.issubset({str(row['id']) for row in current}):
                raise RuntimeError('Missing records after deployment')
        report = {'version': version, 'status': 'passed', 'deployed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'backup': str(backup), 'unchanged_services': list(ids), 'visits_preserved': len(visits), 'reservations_preserved': len(reservations)}
        (release / 'deployment-report.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
    except Exception:
        shutil.copy2(backup / '.env.docker', env_file)
        run(compose + ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'frontend'])
        (release / 'deployment-report.json').write_text(json.dumps({'version': version, 'status': 'rolled_back', 'backup': str(backup)}))
        raise


if __name__ == '__main__':
    main()
