"""Bounded token-free host/helper handshake; each request rechecks the live guard.
The command must be the exact reviewed installation helper, never a shell string.
"""
import json
import os
import selectors
import subprocess
import time


def guarded_command(command, operation, check, timeout=180):
    p = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL)
    selector = selectors.DefaultSelector()
    selector.register(p.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + timeout
    buffer = b''
    sequence = 0
    result = None
    try:
        while time.monotonic() < deadline:
            ready = selector.select(timeout=min(1, max(0, deadline - time.monotonic())))
            if not ready:
                if p.poll() is not None:
                    break
                continue
            chunk = os.read(p.stdout.fileno(), 8192)
            if not chunk:
                break
            buffer += chunk
            if len(buffer) > 32768:
                raise RuntimeError('guard_bridge_oversize')
            while b'\n' in buffer:
                line, buffer = buffer.split(b'\n', 1)
                frame = json.loads(line)
                if frame.get('event') == 'gate-request':
                    if (result is not None or frame.get('operationId') != operation or
                            type(frame.get('sequence')) is not int or frame['sequence'] != sequence or sequence >= 10):
                        raise RuntimeError('guard_bridge_binding')
                    try:
                        check()
                    except BaseException:
                        p.stdin.write((json.dumps({'event': 'gate-ack', 'operationId': operation,
                            'sequence': sequence, 'allow': False})+'\n').encode())
                        p.stdin.flush()
                        raise
                    p.stdin.write((json.dumps({'event': 'gate-ack', 'operationId': operation,
                        'sequence': sequence, 'allow': True})+'\n').encode())
                    p.stdin.flush()
                    sequence += 1
                elif (result is None and frame == {'status': 'nine-writes-acknowledged', 'operationId': operation}):
                    result = frame
                else:
                    raise RuntimeError('guard_bridge_unexpected_frame')
        if (buffer or p.wait(timeout=max(.1, min(10, deadline-time.monotonic()))) != 0 or
                result is None or sequence != 10):
            raise RuntimeError('guard_bridge_incomplete')
        return {**result, 'guardChecks': sequence}
    finally:
        selector.close()
        p.stdin.close()
        if p.poll() is None:
            try:
                p.wait(timeout=12)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait(timeout=5)
        p.stdout.close()
