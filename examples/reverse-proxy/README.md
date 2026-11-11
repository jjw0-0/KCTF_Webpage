# Reverse proxy examples

These files are examples for hosts that already run a reverse proxy. They are
not loaded by Docker Compose.

- `Caddyfile`: proxies a host-installed Caddy to `127.0.0.1:3333`.
- `nginx.conf`: does the same with Nginx and writes the JSON access log used by
  the administrator log page.

Copy one file, replace its domain and certificate values, test the server
configuration, then reload that server. Do not enable both. Create
`/var/log/kctf` first and make it writable by the selected proxy service.
