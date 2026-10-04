// A non-HTTP foundation process must never open a network listener.
import net from 'node:net';
net.Server.prototype.listen = function () {
  throw new Error('Unexpected network listener in non-HTTP entry point');
};
