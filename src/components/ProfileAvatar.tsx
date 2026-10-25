'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/components/ConfirmDialog';

type ProfileAvatarProps = {
  avatarData?: string;
  initials: string;
};

export default function ProfileAvatar({ avatarData, initials }: ProfileAvatarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('PNG, JPEG, WebP · 최대 10MB');
  const [busy, setBusy] = useState(false);
  const { confirm, confirmation } = useConfirmDialog();

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatus('10MB 이하 이미지를 선택해 주세요.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setBusy(true);
    setStatus('업로드 중…');
    const form = new FormData();
    form.set('avatar', file);
    try {
      const response = await fetch('/api/profile/avatar', { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '이미지를 업로드하지 못했습니다.');
      setStatus('프로필 이미지를 변경했습니다.');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '이미지를 업로드하지 못했습니다.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    if (!(await confirm({ title: '프로필 이미지 삭제', description: '현재 프로필 이미지를 삭제하고 이니셜 표시로 되돌립니다.', confirmLabel: '이미지 삭제', danger: true }))) return;
    setBusy(true);
    setStatus('삭제 중…');
    try {
      const response = await fetch('/api/profile/avatar', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '이미지를 삭제하지 못했습니다.');
      setStatus('프로필 이미지를 삭제했습니다.');
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '이미지를 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-avatar-editor">
      <div className="profile-avatar" aria-hidden={!avatarData}>
        {avatarData ? <Image src={avatarData} alt="프로필 이미지" width={128} height={128} unoptimized /> : initials}
      </div>
      <div className="profile-avatar-actions">
        <label className={busy ? 'is-disabled' : ''}>
          사진 변경
          <input ref={inputRef} type="file" name="avatar" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => void uploadAvatar(event.target.files?.[0])} />
        </label>
        {avatarData && <button type="button" disabled={busy} onClick={() => void removeAvatar()}>삭제</button>}
      </div>
      <p aria-live="polite">{status}</p>
      {confirmation}
    </div>
  );
}
