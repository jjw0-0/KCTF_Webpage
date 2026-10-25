import assert from 'node:assert/strict';
import test from 'node:test';
import { getVideoSource, safeResourceUrl } from '../src/lib/challenge-media.ts';

test('resources accept hosted and local files without executable URLs', () => {
  assert.equal(safeResourceUrl('/files/challenge.zip'), '/files/challenge.zip');
  assert.equal(safeResourceUrl('https://cdn.example.com/file.zip?signature=123'), 'https://cdn.example.com/file.zip?signature=123');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//evil.example', '/\\evil.example', 'https://user:password@example.com', 'https://example.com\n/file']) {
    assert.equal(safeResourceUrl(url), undefined, url);
  }
});

test('video links support native media and trusted embeds', () => {
  assert.deepEqual(getVideoSource('/media/demo.webm?token=abc'), { kind: 'video', src: '/media/demo.webm?token=abc' });
  assert.deepEqual(getVideoSource('https://cdn.example.com/demo.mp4'), { kind: 'video', src: 'https://cdn.example.com/demo.mp4' });
  for (const url of ['https://youtu.be/abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk', 'https://youtube.com/shorts/abcdefghijk']) {
    assert.deepEqual(getVideoSource(url), { kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/abcdefghijk' });
  }
  assert.deepEqual(getVideoSource('https://vimeo.com/123456'), { kind: 'embed', src: 'https://player.vimeo.com/video/123456' });
  for (const url of ['https://youtube.com.evil.example/watch?v=abcdefghijk', 'https://evil.example/embed/123', 'javascript:alert(1)', 'https://youtube.com/watch?v=invalid', 'https://example.com/notes']) {
    assert.equal(getVideoSource(url), undefined, url);
  }
});
