# 공개 저장소 정책 설정 가이드

이 문서는 유지관리자가 결정하고 설정할 항목을 정리한 가이드입니다. 아래 GitHub 설정이 실제 원격 저장소에 적용되었다는 뜻은 아닙니다.

## 라이선스 결정

K.knock이 코드와 로고, 글꼴, 문제 자료, 기여 코드의 공개 권한을 갖는지 먼저 확인합니다. 조직이 원하는 재사용 조건에 따라 MIT·Apache-2.0 같은 허용적 라이선스, GPL-3.0 같은 카피레프트 라이선스, 라이선스 없이 소스만 공개하는 방식 등을 검토합니다. 저작자 표시, 특허, 재배포 조건을 확인한 뒤 승인된 `LICENSE` 원문과 저작권자·연도를 추가하고 두 README와 기여 안내를 갱신합니다.

**이 문서는 라이선스를 선택하지 않습니다.** 현재 저작권 표시는 재사용 허가를 뜻하지 않습니다. 공개 저장소에 라이선스가 없을 때의 효과는 [GitHub 라이선스 안내](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)를 참고하세요.

## 기여와 병합 기준

[CONTRIBUTING.md](../CONTRIBUTING.md)에 개발 확인 명령과 변경 제안 절차가 있습니다. 유지관리자는 외부 기여 수용 여부, 병합 권한, 필수 검토자, 행동 강령이나 기여자 계약의 필요성을 결정해야 합니다. 운영 비밀값, 참가자 정보, 미공개 플래그, 비공개 배포 ZIP은 공개 이슈와 PR에 올리지 않습니다.

현재 [CI](../.github/workflows/ci.yml)는 PR과 `Master` 푸시에서 `checks`와 `browser` 작업을 실행합니다. 이를 실제 병합 조건으로 삼으려면 저장소 **Settings → Branches**에서 `Master` 보호 규칙을 만들고, PR 검토 및 필수 상태 검사에서 첫 실행 후 GitHub에 표시된 두 작업의 정확한 검사 이름을 선택합니다. 필요하면 직접 푸시 제한도 설정합니다. 워크플로 파일만 추가해도 병합 제한이 자동으로 생기지는 않습니다. 자세한 경로와 선택지는 [GitHub 보호 브랜치 안내](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)에서 확인하세요.

## 비공개 보안 신고 경로

유지관리자가 실제로 확인할 수 있는 경로를 정합니다. GitHub를 선택한다면 **Settings → Advanced Security → Private vulnerability reporting**에서 기능을 켜고 알림 수신자를 점검합니다. 또는 K.knock이 관리하는 보안 메일 주소를 사용할 수 있습니다. 그 다음 정확한 신고 경로, 지원 버전, 첫 응답 담당자와 공개 조율 방식을 담은 `SECURITY.md`를 공개합니다. 기능 활성화와 `SECURITY.md` 게시물은 별개입니다. 채널이 확인되기 전에는 공개 이슈에 취약점 재현 내용을 올리도록 안내하지 않습니다. [GitHub 비공개 신고 설정](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)과 [보안 정책 안내](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/add-security-policy)를 참고하세요.

## 이미지 릴리스와 배포 권한

[Release images 워크플로](../.github/workflows/release.yml)는 `Master`에서 수동 실행 시 CI를 거쳐 커밋 SHA가 붙은 웹·instancer 이미지를 GHCR에 게시합니다. 다른 브랜치에서 수동 실행하면 CI는 진행되지만 이미지 게시 작업은 건너뜁니다. 현재 운영 호스트로 배포하지는 않습니다. 릴리스 승인을 강제하려면 저장소 **Settings → Environments → release**에서 **Required reviewers**와 필요 시 **Prevent self-review**, 허용 브랜치를 직접 설정하세요. 워크플로의 `environment: release` 이름만으로는 승인 대기가 생기지 않습니다. 저장소 공개 상태와 요금제에 따라 보호 규칙 사용 가능 범위가 다를 수 있으니 [GitHub 환경 설정 안내](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)를 확인하세요.

[Deploy production 워크플로](../.github/workflows/deploy.yml)는 수동 실행 시 먼저 CI를 실행합니다. `production` 환경의 Required reviewers를 설정한 경우에만 SSH 배포 작업 전에 승인 대기가 생깁니다. **Settings → Environments → production**에서 검토자와 `Master` 브랜치 제한을 설정하고, [운영 가이드](operations.md)의 SSH 비밀값과 호스트를 준비해야 승인 게이트와 배포를 사용할 수 있습니다. 환경 이름만으로 승인 대기가 생기지 않습니다. 호스트 스크립트는 변경 전 PostgreSQL 백업과 변경 후 상태 확인을 수행하지만 데이터베이스 자동 롤백은 하지 않습니다. AI가 변경안과 로컬 커밋을 준비하는 방식은 선택할 수 있지만 원격 push, 병합, 이미지 게시, 배포는 각각 소유자의 명시적 승인 대상입니다. 참가자 문제 VM의 `Instance 종료`·`이 문제로 교체`는 각각 확인창을 거친 뒤에만 요청됩니다. [운영 가이드](operations.md)를 참고하세요.
