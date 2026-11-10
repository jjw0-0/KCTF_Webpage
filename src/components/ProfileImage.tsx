import Image from 'next/image';

export default function ProfileImage({ src, name }: { src?: string; name: string }) {
  return (
    <div className="profile-avatar" aria-label={`${name} 프로필 이미지`}>
      {src ? <Image src={src} alt="" width={128} height={128} unoptimized /> : name.slice(0, 2).toUpperCase()}
    </div>
  );
}
