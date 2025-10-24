/**
 * 접근 권한 없음 페이지
 * 로그인하지 않은 사용자가 보호된 페이지에 접근했을 때 표시
 */
import PageLayout from '@/components/PageLayout';

export default function AccessDeniedPage() {
  return (
    <PageLayout>
      <main className="flex-1 flex items-center justify-center">
        <p className="text-lg">접근 권한이 없습니다.</p>
      </main>
    </PageLayout>
  );
}
