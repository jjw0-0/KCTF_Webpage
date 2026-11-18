import Markdown from 'react-markdown';
import { getVideoSource, safeResourceUrl } from '@/lib/challenge-media';

export default function ChallengeDescription({ content }: { content: string }) {
  return (
    <div className="challenge-description">
      <Markdown
        skipHtml
        urlTransform={(url) => safeResourceUrl(url) ?? ''}
        components={{
          a: ({ href, children }) => {
            if (!href) return <span>{children}</span>;
            const video = getVideoSource(href);
            if (video?.kind === 'video') return (
              <span className="description-media">
                <video controls playsInline preload="metadata" src={video.src} aria-label={String(children)} />
                <a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>
              </span>
            );
            if (video?.kind === 'embed') return (
              <span className="description-media">
                <iframe src={video.src} title={String(children)} loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />
                <a href={href} target="_blank" rel="noopener noreferrer">{children} ↗</a>
              </span>
            );
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          img: ({ src, alt }) => src ? (
            // Challenge media can come from author-provided hosts and does not use the image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ''} loading="lazy" />
          ) : <span>{alt}</span>,
        }}
      >{content}</Markdown>
    </div>
  );
}
