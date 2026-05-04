# bible-app-family

가족이 함께 사용하는 성경 묵상 웹앱. React + Vite + Firebase 기반.

## 라이브 URL / 주요 정보

- **호스팅:** https://filsa-bible.web.app
- **Firebase 프로젝트:** `filsa-bible` (콘솔: https://console.firebase.google.com/project/filsa-bible)
- **GitHub:** https://github.com/moonden93/bible-app-family (`main` 브랜치)
- **소유자 계정:** moonden93@gmail.com (Firebase, GitHub 동일)

## 스택

- **프레임워크:** React 19 + Vite 8 + Tailwind 3
- **백엔드:** Firebase Auth (Google 로그인) + Firestore (실시간 동기화)
- **호스팅:** Firebase Hosting
- **아이콘:** lucide-react
- **번들 위치:** 빌드 결과물 → `dist/`

전체 앱은 한 파일(`src/App.jsx`, ~2,400줄)에 들어있음. 컴포넌트가 한 파일에 모두 모여 있는 구조이며, 분리하지 말고 이 안에서 편집할 것.

## 데이터 구조 (Firestore)

```
families/{familyId}
  ├─ name, createdBy, createdAt, inviteCode
  ├─ members: [{ uid, displayName, email, photoURL, colorId, joinedAt }]
  ├─ journals: [...]          # 묵상 기록
  ├─ bookmarks: [...]         # 즐겨찾기 구절
  ├─ completed: [{ key, byUid, completedAt }]   # 읽기 완료 장
  ├─ prayers: [...]           # 기도제목
  ├─ comments: { [targetId]: [...] }   # 묵상/기도 댓글
  ├─ activePlan, dailyProverbs

userFamilies/{uid}
  └─ familyId   # 사용자 → 가족방 매핑
```

기존 가족방 문서에 `transcripts` 필드가 남아있을 수 있음(과거 필사 기능 잔재). 새 클라이언트는 읽지도 쓰지도 않으므로 무시. 정리는 선택사항.

## 개발 / 배포 절차 (필수 순서)

수정사항이 발생하면 **항상 이 순서대로 끝까지** 진행한다. 도중 중단 금지.

```bash
# 1. 빌드
npm run build

# 2. 커밋 + GitHub push (소스 보존)
git add <변경 파일들>
git commit -m "..."
git push origin main

# 3. Firebase Hosting 배포 (폰에 반영)
firebase deploy --only hosting
```

GitHub push만 해서는 폰에 안 보임. **`firebase deploy`까지 완료해야 라이브 URL이 갱신된다.**

배포 후 확인: https://filsa-bible.web.app — 폰은 캐시 갱신을 위해 새로고침 한 번 필요할 수 있음.

## 새 PC에서 처음 셋업할 때

```bash
git clone https://github.com/moonden93/bible-app-family.git
cd bible-app-family
npm install

# Firebase CLI (전역 설치)
npm install -g firebase-tools
firebase login          # 브라우저로 moonden93@gmail.com 로그인 (인터랙티브)
firebase use filsa-bible
```

`firebase.json`, `.firebaserc`는 리포에 포함되어 있으므로 `firebase init`은 다시 할 필요 없다.

Windows PowerShell에서 `firebase` 명령이 실행 정책 오류를 내면 Git Bash나 cmd로 실행할 것. (`Set-ExecutionPolicy`를 변경하지 말 것 — 시스템 전체 영향)

## 로컬 개발

```bash
npm run dev      # http://localhost:5173 (또는 vite가 알려주는 포트)
```

`src/App.jsx`만 편집하면 된다. Firebase 설정(`src/firebase.js`)은 클라이언트 키라 공개되어 있어도 안전(보안은 Firestore 룰로 처리됨).

## 코드 작업 가이드

- **단일 파일 원칙:** `src/App.jsx`에 모든 컴포넌트가 있다. 새 컴포넌트도 이 파일 안에 추가.
- **상수:** 파일 상단 `BOOK_ORDER`, `FOCUS_PRESETS`, `FONT_SIZES`, `COLOR_PALETTE` 참고.
- **Firestore 저장:** `BibleApp` 컴포넌트의 `saveToCloud(patch)` 사용. 디바운스 처리되어 있음.
- **사용자 색상:** 각 가족 멤버는 `colorId`(COLOR_PALETTE의 id) 하나를 가짐. 묵상/기도/댓글 카드에 그 색이 적용됨.
- **언어:** UI는 한국어. 코드 내 코멘트/문자열도 한국어 유지.
- **이모지:** 사용자가 명시적으로 요청하지 않으면 코드/문서에 이모지 추가 금지.

## 알려진 제약 / 참고

- 번들 크기 631 KB(gzip 188 KB). 빌드 시 chunk size 경고 나오는데 현재 무시.
- 이미지/SVG 외에 추가 에셋 없음.
- 모바일 사용 비중이 높으므로 화면 변경 시 모바일 레이아웃을 우선 고려.
- `BOOK_ORDER`는 한국어 성경 책 ID 순서(101~227, 구약 101~139, 신약 201~227).
