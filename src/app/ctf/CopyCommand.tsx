'use client';

import { useState } from 'react';

export default function CopyCommand({ command, codeClassName }: { command: string; codeClassName?: string }) {
  const [status, setStatus] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setStatus('복사했습니다');
    } catch {
      setStatus('복사할 수 없습니다. 명령어를 선택해 직접 복사해 주세요.');
    }
  };

  return (
    <span className="copy-command">
      <code className={codeClassName}>{command}</code>
      <button type="button" onClick={() => void copy()} aria-label="명령어 복사">복사</button>
      <span className="copy-command-status" role="status">{status}</span>
    </span>
  );
}
