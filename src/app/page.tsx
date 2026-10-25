import Link from 'next/link';
import { auth } from '@/auth';
import ElectricLogo from '@/components/ElectricLogo';
import PageLayout from '@/components/PageLayout';
import { getCategories } from '@/lib/categories';
import { getCtfSchedule } from '@/lib/ctf-schedule';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [session, allCategories, schedule] = await Promise.all([auth(), getCategories(), getCtfSchedule()]);
  const categories = allCategories.filter((category) => category.visible);
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <PageLayout>
      <main className="landing-main">
        <section className="landing-stage" aria-labelledby="landing-title">
          <div className="landing-grid">
            <div className="landing-mark">
              <h1 id="landing-title">
                <span className="sr-only">KCTF</span>
                <ElectricLogo
                  className="landing-electric-logo"
                  color="#95f0d4"
                  glowColor="#149e7a"
                  scale={0.76}
                  intensity={0.72}
                  glow={0.62}
                  thickness={2.15}
                  strands={4}
                  bend={0.48}
                  crackle={1.25}
                  arcs={1.0}
                  flicker={0.4}
                  fill={0.14}
                  speed={2.1}
                  interactive
                  cursorIntensity={0.75}
                  cursorRadius={120}
                />
              </h1>
              <p><time dateTime={schedule.startTime}>{schedule.startLabel}</time><span>~</span><time dateTime={schedule.endTime}>{schedule.endLabel}</time></p>
            </div>

            <div className="landing-categories" aria-label="문제 카테고리">
              <h2>category</h2>
              <div>
                {categories.map((category) => (
                  <span key={category.id}>
                    {category.shortName.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="landing-actions">
            {isAuthenticated ? (
              <Link href="/ctf">참가하기 <span aria-hidden="true">→</span></Link>
            ) : (
              <>
                <Link href="/login">로그인</Link>
                <Link href="/register">참가하기 <span aria-hidden="true">→</span></Link>
              </>
            )}
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
