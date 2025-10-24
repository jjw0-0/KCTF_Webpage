/**
 * 404 페이지
 * 존재하지 않는 페이지에 접근했을 때 표시
 */
import PageLayout from '@/components/PageLayout';

export default function NotFoundPage() {
  return (
    <PageLayout>
      <main className="flex-1 flex items-center justify-center">
        <p className="text-lg">페이지를 찾을 수 없습니다.</p>
      </main>
    </PageLayout>
  );
}
