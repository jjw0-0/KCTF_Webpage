import Link from 'next/link';
import PageLayout from '@/components/PageLayout';
import { getCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const categories = (await getCategories()).filter((category) => category.visible);

  return (
    <PageLayout>
      <main className="landing-main">
        <section className="landing-stage" aria-labelledby="landing-title">
          <div className="landing-grid">
            <div className="landing-mark">
              <h1 id="landing-title">KCTF</h1>
              <p><time dateTime="2026-12-10">2026.12.10</time><span>~</span><time dateTime="2026-12-13">2026.12.13</time></p>
            </div>

            <nav className="landing-categories" aria-label="문제 카테고리">
              <h2>category</h2>
              <div>
                {categories.map((category) => (
                  <Link key={category.id} href={`/ctf?category=${category.slug}`}>
                    {category.shortName.toLowerCase()}
                  </Link>
                ))}
              </div>
            </nav>
          </div>

          <div className="landing-actions">
            <Link href="/login">로그인</Link>
            <Link href="/ctf">참가하기 <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
