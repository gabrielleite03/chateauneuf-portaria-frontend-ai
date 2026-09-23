#!/usr/bin/env python3
"""Deploy frontend/backend from a release manifest; see the adjacent README."""

import argparse
import datetime
import json
import os
import pathlib
import re
import shutil
import sqlite3
import subprocess
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=pathlib.Path, required=True)
    parser.add_argument('--project', type=pathlib.Path, required=True)
    parser.add_argument('--release-dir', type=pathlib.Path, required=True)
    parser.add_argument('--base-url', default='http://127.0.0.1:8081')
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    if not __debug__:
        parser.error('Do not run with -O: deployment checks must remain enabled.')
    manifest = json.loads(args.manifest.read_text(encoding='utf-8-sig'))
    VERSION = manifest['version']
    if not re.fullmatch(r'[0-9]+(?:\.[0-9]+)+', VERSION):
        parser.error('Invalid release version')
    PROJECT = args.project.resolve()
    RELEASE = args.release_dir.resolve()
    BACKUP = PROJECT / 'backups' / ('before-' + VERSION)
    COMPOSE = ['docker', 'compose', '--env-file', '.env.docker']
    for filename in ['.env.docker', 'docker-compose.yml', 'data/portaria.db']:
        if not (PROJECT / filename).is_file():
            parser.error('Missing project file: ' + filename)
    if BACKUP.exists():
        parser.error('Backup already exists: ' + str(BACKUP))
    for service in ['frontend', 'backend']:
        image = manifest[service]['image']
        digest = manifest[service]['digest']
        if not image.endswith(':' + VERSION):
            parser.error('Image tag does not match version: ' + service)
        if not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
            parser.error('Invalid image digest: ' + service)
        if not re.fullmatch(r'[0-9a-f]{7,40}', manifest[service]['commit']):
            parser.error('Invalid commit: ' + service)
        details = json.loads(subprocess.check_output(
            ['docker', 'image', 'inspect', image], text=True))[0]
        expected = image.rsplit(':', 1)[0] + '@' + digest
        if expected not in (details.get('RepoDigests') or []):
            parser.error('Local image digest mismatch; pull the published image: ' + image)
    subprocess.run(COMPOSE + ['config', '--quiet'], cwd=PROJECT, check=True)
    if args.check_only:
        print(json.dumps({'version': VERSION, 'checks': 'passed', 'changed': False}))
        return

    def run(args):
        return subprocess.check_output(args, cwd=PROJECT, text=True, stderr=subprocess.PIPE)

    def fetch(path):
        with urllib.request.urlopen(args.base_url.rstrip('/') + path, timeout=10) as response:
            return response.read().decode()

    def logs():
        return json.loads(fetch('/api/access-logs'))

    RELEASE.mkdir(mode=0o700, parents=True, exist_ok=True)
    BACKUP.mkdir(mode=0o700, parents=True, exist_ok=False)
    os.chmod(BACKUP, 0o700)
    for filename in ['.env.docker', 'docker-compose.yml', 'docker-compose.override.yml']:
        if (PROJECT / filename).exists():
            shutil.copy2(PROJECT / filename, BACKUP / filename)

    reservations_before = json.loads(fetch('/api/reservations'))
    (BACKUP / 'reservations.json').write_text(json.dumps(reservations_before))
    before = logs()
    (BACKUP / 'access-logs.json').write_text(json.dumps(before))
    source = sqlite3.connect((PROJECT / 'data/portaria.db').as_uri() + '?mode=ro', uri=True)
    destination = sqlite3.connect(str(BACKUP / 'portaria.db'))
    source.backup(destination)
    assert destination.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    destination.close()
    source.close()
    print(json.dumps({'backup': str(BACKUP), 'visits_before': len(before), 'active_before': sum(not x['exit_at'] for x in before)}), flush=True)

    previous = json.loads(run(COMPOSE + ['config', '--format', 'json']))
    before_images = {key: val['image'] for key, val in previous['services'].items()}
    (BACKUP / 'images.json').write_text(json.dumps(before_images, indent=2))

    env_path = PROJECT / '.env.docker'
    env_text = env_path.read_text()
    for service in ['frontend', 'backend']:
        key = service.upper() + '_IMAGE'
        env_text, replacements = re.subn(r'^' + key + r'=.*$', lambda _: key + '=' + manifest[service]['image'], env_text, flags=re.M)
        assert replacements == 1, 'Unexpected image configuration: ' + key

    try:
        env_path.write_text(env_text)
        planned = json.loads(run(COMPOSE + ['config', '--format', 'json']))
        for key, val in previous['services'].items():
            expected = dict(val)
            if key in ['frontend', 'backend']:
                expected['image'] = manifest[key]['image']
            assert planned['services'][key] == expected, 'Unexpected configuration change: ' + key
        print(run(COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'backend', 'frontend']), flush=True)
        deadline = time.monotonic() + 75
        while True:
            try:
                version = json.loads(fetch('/api/version'))
                assert version['version'] == VERSION
                assert version['commit'] == manifest['backend']['commit']
                html = fetch('/')
                script = re.search(r'src="(/assets/[^\"]+\.js)"', html).group(1)
                bundle = fetch(script)
                assert VERSION in bundle and manifest['frontend']['commit'] in bundle and 'active-visits-heading' in bundle and 'active-deliveries-heading' in bundle and 'Lista de convidados' in bundle
                break
            except Exception:
                if time.monotonic() > deadline:
                    raise
                time.sleep(2)
        # Wait for the startup import to finish before checking preserved exits.
        for attempt in range(30):
            startup = run(COMPOSE + ['logs', '--no-color', '--since', '2m', 'backend'])
            if 'initial access log import finished' in startup:
                break
            if 'initial access log import failed' in startup:
                raise RuntimeError('Initial access log import failed')
            time.sleep(2)
        else:
            raise RuntimeError('Initial access log import did not finish')
        after = logs()
        by_external = {x['external_id']: x for x in after if x['external_id']}
        by_id = {x['id']: x for x in after}
        for old in before:
            current = by_external.get(old['external_id']) if old['external_id'] else by_id.get(old['id'])
            assert current is not None, 'Missing visit after deployment'
            if old['exit_at']:
                assert current['exit_at'], 'Closed visit reopened'
        for attempt in range(45):
            reservations_after = json.loads(fetch('/api/reservations'))
            if all(item['syncStatus'] == 'synced' for item in reservations_after):
                break
            time.sleep(2)
        else:
            raise RuntimeError('Reservations did not finish syncing')
        by_reservation_id = {item['id']: item for item in reservations_after}
        for old in reservations_before:
            current = by_reservation_id.get(old['id'])
            assert current is not None, 'Reservation missing after deployment'
            for key in ['area', 'unit', 'residentName', 'reservationDate', 'startTime', 'endTime', 'signed']:
                assert current[key] == old[key], 'Reservation content changed: ' + key
        for reservation in reservations_after:
            guests = json.loads(fetch('/api/reservations/' + reservation['id'] + '/guests'))
            assert isinstance(guests, list), 'Invalid guest list response'
        status = json.loads(fetch('/api/sync/status'))
        report = {'version': VERSION, 'deployed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'backend': version, 'frontend_bundle': script, 'visits_before': len(before), 'visits_after': len(after),
                  'active_before': sum(not x['exit_at'] for x in before), 'active_after': sum(not x['exit_at'] for x in after),
                  'sync': status, 'backup': str(BACKUP), 'previous_images': before_images, 'reservations_synced': len(reservations_after)}
        (RELEASE / 'deployment-report.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2), flush=True)
    except Exception:
        shutil.copy2(BACKUP / '.env.docker', env_path)
        print('Restoring previous frontend and backend images', flush=True)
        print(run(COMPOSE + ['up', '-d', '--no-deps', '--no-build', '--pull', 'never', 'backend', 'frontend']), flush=True)
        raise


if __name__ == '__main__':
    main()
