# 배포 구성

Netlify는 main 브랜치의 `node build.mjs` 결과인 `dist`와 `netlify/functions`를 함께 배포합니다. 로그인 SDK·바코드·영수증 엔진은 package-lock.json의 고정 버전에서 빌드 시 준비합니다.

본 DB에는 `supabase/flow-stock-receipts.sql`, 통장 DB에는 `supabase/flow-bank-aliases.sql`이 필요합니다. 입금 서버는 `supabase/functions/mimine-bank/index.ts`와 `handler.mjs`를 함께 배포합니다. 기존 운영 환경변수와 명시적 본 앱 JWT 검증을 유지합니다.

실제 적용 후에는 활성 계정 로그인, 실제 합계 대조, 입금 수신 경로, 상품/비용 저장과 중복 방지를 확인합니다. 테스트용 운영 기록은 영구 보관하지 않습니다. `npm test`는 가상 제공자와 로컬 PGlite를 사용하므로 운영 데이터에 쓰지 않습니다.
