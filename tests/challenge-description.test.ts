import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChallengeDescription from '../src/components/ChallengeDescription';

const render = (content: string) => renderToStaticMarkup(createElement(ChallengeDescription, { content }));

test('descriptions render mixed text, images, native video and embedded video', () => {
  const html = render('## 설명\n\n**강조**와 글\n\n![회로도](/diagram.png)\n\n[영상](/demo.mp4)\n\n[참고](https://youtu.be/abcdefghijk)');
  assert.match(html, /<h2>설명<\/h2>/);
  assert.match(html, /<strong>강조<\/strong>/);
  assert.match(html, /<img[^>]+alt="회로도"/);
  assert.match(html, /<video[^>]+controls=""/);
  assert.match(html, /youtube-nocookie.com\/embed\/abcdefghijk/);
  assert.doesNotMatch(html, /autoplay/i);
});

test('description HTML and executable URLs cannot create active content', () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert%281%29)\n\n![image](data:text/html,payload)');
  assert.doesNotMatch(html, /<script|<img|onerror=|href="javascript:|src="data:/);
  assert.match(html, /click/);
});
