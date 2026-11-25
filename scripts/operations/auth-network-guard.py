#!/usr/bin/env python3
"""Wait for the service's LAN IP, ensure Docker networking, and supervise auth."""
import argparse,json,subprocess,time,sys

def run(*args):
 return subprocess.check_output(args,text=True,stderr=subprocess.PIPE).strip()

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--ip',default='192.168.10.100')
 parser.add_argument('--timeout',type=int,default=120)
 parser.add_argument('--check-network-only',action='store_true')
 args=parser.parse_args()
 deadline=time.monotonic()+args.timeout
 while True:
  interfaces=json.loads(run('ip','-j','-4','address','show'))
  if any(a.get('local')==args.ip for i in interfaces for a in i.get('addr_info',[])):break
  if time.monotonic()>=deadline:raise RuntimeError('Required LAN address is not available: '+args.ip)
  time.sleep(2)
 if args.check_network_only:
  print('LAN address ready');return
 name='network-auth-service';network='chateauneufportaria_default'
 current=json.loads(run('docker','inspect',name))[0]
 if network not in current['NetworkSettings']['Networks']:
  run('docker','network','connect','--alias',name,network,name)
 if not current['State']['Running']:run('docker','start',name)
 print('Authentication container running after network readiness check',flush=True)
 code=run('docker','wait',name)
 raise RuntimeError('Authentication container stopped with exit code '+code)

if __name__=='__main__':
 try:main()
 except Exception as e:
  print(str(e),file=sys.stderr);sys.exit(1)
