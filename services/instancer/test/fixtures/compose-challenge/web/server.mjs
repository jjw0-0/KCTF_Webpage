import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end(`ready:${readFileSync('/app/message.txt', 'utf8').trim()}`);
}).listen(8080, '0.0.0.0');
