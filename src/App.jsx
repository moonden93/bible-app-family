import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen, Calendar, NotebookPen, Upload, ChevronLeft, ChevronRight,
  Check, Flame, Search, Download, Trash2, X, Menu, Star,
  Type, Share2, CheckCircle2, Bookmark, Plus, Sunrise, LogOut, Cloud, CloudOff,
  PenLine, Users, Heart, MessageCircle, Copy, UserPlus, Palette,
  Send, MoreVertical, Home, Edit2
} from 'lucide-react';

import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  doc, onSnapshot, setDoc, updateDoc, getDoc, collection,
  arrayUnion, arrayRemove, serverTimestamp, query, where, getDocs
} from 'firebase/firestore';

// ============================================================
// 상수
// ============================================================
const BOOK_ORDER = [
  101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,
  121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,
  201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,
  221,222,223,224,225,226,227
];

const FOCUS_PRESETS = [
  { id: 'gospels_3m', name: '사복음서 3개월', books: [201, 202, 203, 204], days: 90 },
  { id: 'psalms_1m', name: '시편 1개월', books: [119], days: 30 },
  { id: 'proverbs_1m', name: '잠언 1개월', books: [120], days: 31 },
  { id: 'paul_2m', name: '바울서신 2개월', books: [206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218], days: 60 },
  { id: 'pentateuch_4m', name: '모세오경 4개월', books: [101, 102, 103, 104, 105], days: 120 },
  { id: 'nt_6m', name: '신약 6개월', books: [201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227], days: 180 },
  { id: 'prophets_6m', name: '선지서 6개월', books: [123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139], days: 180 },
];

const FULL_DURATION_PRESETS = [
  { days: 180, label: '6개월' },
  { days: 365, label: '1년' },
  { days: 730, label: '2년' },
];

const FONT_SIZES = [
  { verseClass: 'text-[14px]', name: '작게' },
  { verseClass: 'text-[16px]', name: '보통' },
  { verseClass: 'text-[18px]', name: '크게' },
  { verseClass: 'text-[20px]', name: '매우 크게' },
];

// Personal Color 팔레트 (Tailwind stone 계열과 잘 어울리는 색상)
const COLOR_PALETTE = [
  { id: 'rose',    name: '로즈',    bg: '#fda4af', border: '#e11d48', text: '#881337', light: '#fff1f2' },
  { id: 'coral',   name: '코랄',    bg: '#fdba74', border: '#ea580c', text: '#7c2d12', light: '#fff7ed' },
  { id: 'amber',   name: '앰버',    bg: '#fcd34d', border: '#d97706', text: '#78350f', light: '#fffbeb' },
  { id: 'emerald', name: '에메랄드', bg: '#6ee7b7', border: '#059669', text: '#064e3b', light: '#ecfdf5' },
  { id: 'teal',    name: '틸',      bg: '#5eead4', border: '#0d9488', text: '#134e4a', light: '#f0fdfa' },
  { id: 'sky',     name: '하늘색',   bg: '#7dd3fc', border: '#0284c7', text: '#0c4a6e', light: '#f0f9ff' },
  { id: 'indigo',  name: '인디고',   bg: '#a5b4fc', border: '#4f46e5', text: '#312e81', light: '#eef2ff' },
  { id: 'violet',  name: '바이올렛', bg: '#c4b5fd', border: '#7c3aed', text: '#4c1d95', light: '#f5f3ff' },
  { id: 'pink',    name: '핑크',    bg: '#f9a8d4', border: '#db2777', text: '#831843', light: '#fdf2f8' },
  { id: 'slate',   name: '슬레이트', bg: '#94a3b8', border: '#475569', text: '#1e293b', light: '#f8fafc' },
];

// ============================================================
// 유틸
// ============================================================
function getTodayProverbsChapter() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  return kst.getDate();
}

function rotateBookOrder(books, startBookId) {
  const idx = books.indexOf(startBookId);
  if (idx <= 0) return [...books];
  return [...books.slice(idx), ...books.slice(0, idx)];
}

function generatePlanSchedule(preset, bookIndex, customStartBookId) {
  const startBookId = customStartBookId || preset.books[0];
  const orderedBooks = rotateBookOrder(preset.books, startBookId);
  const allChapters = [];
  orderedBooks.forEach(bid => {
    const cc = bookIndex[bid] || 0;
    for (let c = 1; c <= cc; c++) allChapters.push({ bookId: bid, chapter: c });
  });
  const days = preset.days;
  const perDay = Math.ceil(allChapters.length / days);
  const schedule = [];
  for (let d = 0; d < days; d++) {
    schedule.push(allChapters.slice(d * perDay, (d + 1) * perDay));
  }
  while (schedule.length < days) schedule.push([]);
  return schedule;
}

function todayKST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(d1, d2) {
  const a = new Date(d1 + 'T00:00:00');
  const b = new Date(d2 + 'T00:00:00');
  return Math.floor((b - a) / 86400000);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 문자 제외 (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateFamilyId() {
  return 'fam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
}

// ============================================================
// 최상위: 라우팅
// ============================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);

  // 초대 링크에서 코드 추출
  const [pendingInviteCode, setPendingInviteCode] = useState(() => {
    const hash = window.location.hash; // #invite=ABC123
    const match = hash.match(/invite=([A-Z0-9]+)/);
    return match ? match[1] : null;
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        // 사용자가 속한 가족방 조회
        try {
          const userDoc = await getDoc(doc(db, 'userFamilies', u.uid));
          if (userDoc.exists()) {
            setFamilyId(userDoc.data().familyId);
          }
        } catch (err) {
          console.error('가족방 조회 실패:', err);
        }
      } else {
        setFamilyId(null);
      }
      setFamilyLoading(false);
    });
    return () => unsub();
  }, []);

  async function handleLogin() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('로그인 실패:', err);
      alert('로그인 실패: ' + err.message);
    }
  }

  if (authLoading || familyLoading) {
    return (
      <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div className="inline-block w-10 h-10 border-4 border-stone-300 border-t-stone-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  // 1. 로그인 안됨
  if (!user) {
    return <LoginScreen onLogin={handleLogin} pendingInviteCode={pendingInviteCode} />;
  }

  // 2. 로그인은 했는데 가족방 없음
  if (!familyId) {
    return <FamilySetupScreen
      user={user}
      pendingInviteCode={pendingInviteCode}
      onJoined={(fid) => {
        setFamilyId(fid);
        // 초대 코드 히스토리 정리
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setPendingInviteCode(null);
      }}
    />;
  }

  // 3. 정상 앱
  return <BibleApp user={user} familyId={familyId} onLeaveFamily={() => setFamilyId(null)} />;
}

// ============================================================
// 로그인 화면
// ============================================================
function LoginScreen({ onLogin, pendingInviteCode }) {
  return (
    <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-stone-900 text-stone-50 mb-6">
            <BookOpen size={36} strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold text-stone-900 tracking-tight mb-3">필사 (筆寫)</h1>
          <p className="text-stone-500 text-base leading-relaxed">가족과 함께 쓰는 말씀 일기</p>
        </div>

        {pendingInviteCode && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <UserPlus size={20} className="mx-auto text-amber-600 mb-2" />
            <div className="text-sm font-semibold text-amber-900 mb-1">가족방 초대를 받으셨어요</div>
            <div className="text-xs text-amber-700">로그인 후 자동으로 가족방에 참가됩니다</div>
            <div className="text-xs text-amber-600 mt-2 font-mono">초대 코드: {pendingInviteCode}</div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <button onClick={onLogin} className="w-full flex items-center justify-center gap-3 bg-white hover:bg-stone-50 text-stone-900 font-medium py-3.5 rounded-xl transition-colors border border-stone-300">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 시작하기
          </button>
          <p className="text-xs text-stone-400 text-center mt-4 leading-relaxed">
            로그인 후 가족방을 만들거나 초대받은 가족방에 참가할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 가족방 설정 화면 (로그인 후)
// ============================================================
function FamilySetupScreen({ user, pendingInviteCode, onJoined }) {
  const [mode, setMode] = useState(pendingInviteCode ? 'join' : null); // null | 'create' | 'join'
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState(pendingInviteCode || '');
  const [selectedColor, setSelectedColor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateFamily() {
    if (!familyName.trim() || !selectedColor) return;
    setLoading(true);
    setError('');
    try {
      const newFamilyId = generateFamilyId();
      const code = generateInviteCode();
      const member = {
        uid: user.uid,
        displayName: user.displayName || '사용자',
        email: user.email,
        photoURL: user.photoURL || null,
        colorId: selectedColor.id,
        joinedAt: new Date().toISOString(),
      };
      // 가족방 생성
      await setDoc(doc(db, 'families', newFamilyId), {
        name: familyName.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        inviteCode: code,
        members: [member],
        transcripts: {},
        journals: [],
        bookmarks: [],
        completed: [],
        activePlan: null,
        dailyProverbs: false,
        prayers: [],
        comments: {}, // { journalId: [...], prayerId: [...] }
      });
      // 유저 → 가족방 매핑
      await setDoc(doc(db, 'userFamilies', user.uid), {
        familyId: newFamilyId,
      });
      onJoined(newFamilyId);
    } catch (err) {
      console.error(err);
      setError('가족방 생성 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinFamily() {
    if (!inviteCode.trim() || !selectedColor) return;
    setLoading(true);
    setError('');
    try {
      // 초대 코드로 가족방 검색
      const familiesRef = collection(db, 'families');
      const q = query(familiesRef, where('inviteCode', '==', inviteCode.trim().toUpperCase()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setError('초대 코드가 유효하지 않습니다.');
        setLoading(false);
        return;
      }
      const familyDoc = snapshot.docs[0];
      const fid = familyDoc.id;
      const familyData = familyDoc.data();

      // 이미 참가한 경우
      if (familyData.members?.some(m => m.uid === user.uid)) {
        await setDoc(doc(db, 'userFamilies', user.uid), { familyId: fid });
        onJoined(fid);
        return;
      }

      // 멤버 추가
      const newMember = {
        uid: user.uid,
        displayName: user.displayName || '사용자',
        email: user.email,
        photoURL: user.photoURL || null,
        colorId: selectedColor.id,
        joinedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'families', fid), {
        members: arrayUnion(newMember),
      });
      await setDoc(doc(db, 'userFamilies', user.uid), { familyId: fid });
      onJoined(fid);
    } catch (err) {
      console.error(err);
      setError('참가 실패: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try { await signOut(auth); } catch (err) { console.error(err); }
  }

  // 초기 선택 화면
  if (mode === null) {
    return (
      <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-stone-900 text-stone-50 mb-5">
              <Users size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight mb-2">
              {user.displayName || user.email}님, 환영해요!
            </h1>
            <p className="text-stone-500 text-sm">가족방을 시작하거나 참가해주세요</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-white border-2 border-stone-200 hover:border-stone-900 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Plus size={22} strokeWidth={2} />
                </div>
                <div>
                  <div className="font-bold text-base text-stone-900 mb-1">새 가족방 만들기</div>
                  <div className="text-xs text-stone-500">처음 시작하는 분이라면</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full bg-white border-2 border-stone-200 hover:border-stone-900 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <UserPlus size={22} strokeWidth={2} />
                </div>
                <div>
                  <div className="font-bold text-base text-stone-900 mb-1">초대 코드로 참가</div>
                  <div className="text-xs text-stone-500">가족이 보낸 초대 코드 입력</div>
                </div>
              </div>
            </button>
          </div>

          <button onClick={handleLogout} className="w-full mt-6 py-2 text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center justify-center gap-1">
            <LogOut size={12} /> 다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  // 가족방 만들기 / 참가하기 (색상 선택 포함)
  return (
    <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="max-w-md w-full">
        <button onClick={() => { setMode(null); setError(''); }} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-6">
          <ChevronLeft size={16} /> 뒤로
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          {mode === 'create' ? (
            <>
              <h2 className="text-xl font-bold tracking-tight mb-1">새 가족방 만들기</h2>
              <p className="text-sm text-stone-500 mb-6">가족방 이름과 내 색을 정해주세요</p>
              <div className="mb-5">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">가족방 이름</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  placeholder="예: 김씨네 가족"
                  maxLength={30}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-stone-400"
                />
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold tracking-tight mb-1">가족방에 참가하기</h2>
              <p className="text-sm text-stone-500 mb-6">초대 코드를 입력하고 내 색을 정해주세요</p>
              <div className="mb-5">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">초대 코드</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="예: XY7B2K"
                  maxLength={6}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-base font-mono tracking-widest text-center focus:outline-none focus:border-stone-400"
                />
              </div>
            </>
          )}

          <div className="mb-6">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
              <Palette size={12} className="inline mr-1" />
              나의 색상 (Personal Color)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedColor(c)}
                  className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center ${
                    selectedColor?.id === c.id ? 'border-stone-900 scale-110 shadow-lg' : 'border-stone-200 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.bg }}
                  title={c.name}
                >
                  {selectedColor?.id === c.id && (
                    <Check size={20} strokeWidth={3} style={{ color: c.text }} />
                  )}
                </button>
              ))}
            </div>
            {selectedColor && (
              <div className="mt-3 text-center text-xs text-stone-500">
                선택됨: <span className="font-semibold" style={{ color: selectedColor.text }}>{selectedColor.name}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={mode === 'create' ? handleCreateFamily : handleJoinFamily}
            disabled={loading || !selectedColor || (mode === 'create' ? !familyName.trim() : !inviteCode.trim())}
            className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : mode === 'create' ? '가족방 만들기' : '참가하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 본 앱 (가족방 안)
// ============================================================
function BibleApp({ user, familyId, onLeaveFamily }) {
  const [bible, setBible] = useState(null);
  const [bibleLoading, setBibleLoading] = useState(true);
  const [familyData, setFamilyData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [view, setView] = useState('read'); // read | plan | journal | prayer | settings | write
  const [bookId, setBookId] = useState(101);
  const [chapter, setChapter] = useState(1);
  const [fontSizeIdx, setFontSizeIdx] = useState(1);

  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  const [shareCard, setShareCard] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');

  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  const pendingPatchRef = useRef({}); 
  const syncTimerRef = useRef(null);

  const familyDocRef = useMemo(() => doc(db, 'families', familyId), [familyId]);

  // 가족 데이터 실시간 구독
  useEffect(() => {
    const unsub = onSnapshot(familyDocRef, (snap) => {
      if (snap.exists()) {
        setFamilyData({ id: snap.id, ...snap.data() });
      } else {
        // 가족방이 삭제됨
        setFamilyData(null);
      }
      setDataLoading(false);
    }, (err) => {
      console.error('가족 데이터 구독 실패:', err);
      setDataLoading(false);
    });
    return () => unsub();
  }, [familyDocRef]);

  // 성경 데이터 로드
  useEffect(() => {
    fetch('/bible.json')
      .then(r => { if (!r.ok) throw new Error('bible.json을 찾을 수 없습니다.'); return r.json(); })
      .then(data => {
        const normalized = normalizeBible(data);
        setBible(normalized);
        if (normalized.books.length > 0) setBookId(normalized.books[0].id);
        setBibleLoading(false);
      })
      .catch(err => { setLoadError(err.message); setBibleLoading(false); });
  }, []);

  function normalizeBible(data) {
    if (data.books && data.books[0]?.chapters) {
      return {
        v: data.version || '개역개정',
        books: data.books.map(b => ({
          id: b.id, n: b.name, a: b.abbr, e: b.eng, t: b.testament,
          c: b.chapters.map(ch => {
            const headings = {};
            ch.verses.forEach(v => { if (v.heading) headings[v.verse] = v.heading; });
            return {
              v: ch.verses.map(v => v.text),
              ...(Object.keys(headings).length > 0 ? { h: headings } : {})
            };
          })
        }))
      };
    }
    return data;
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const normalized = normalizeBible(data);
        setBible(normalized);
      } catch (err) {
        alert('파일 로드 실패: ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // 클라우드 저장 (디바운스)
function saveToCloud(patch) {
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    setSyncStatus('syncing');
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const combinedPatch = { ...pendingPatchRef.current };
      pendingPatchRef.current = {};
      try {
        await updateDoc(familyDocRef, { ...combinedPatch, updatedAt: serverTimestamp() });
        setSyncStatus('synced');
        showSavedToast();
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (err) {
        console.error('저장 실패:', err);
        setSyncStatus('error');
        alert('저장 실패: ' + err.message);
      }
    }, 300);
  }

  function showSavedToast() {
    setSavedToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setSavedToast(false), 1200);
  }

  // 사용자 색상 조회
  function getUserColor(uid) {
    const member = familyData?.members?.find(m => m.uid === uid);
    if (!member) return COLOR_PALETTE[9]; // fallback: slate
    return COLOR_PALETTE.find(c => c.id === member.colorId) || COLOR_PALETTE[9];
  }
  function getUserInfo(uid) {
    return familyData?.members?.find(m => m.uid === uid);
  }

  const myColor = getUserColor(user.uid);

  // 파생 데이터
  const bookMap = useMemo(() => {
    if (!bible) return {};
    const m = {};
    bible.books.forEach(b => { m[b.id] = b; });
    return m;
  }, [bible]);

  const chapterCountIndex = useMemo(() => {
    if (!bible) return {};
    const m = {};
    bible.books.forEach(b => { m[b.id] = b.c.length; });
    return m;
  }, [bible]);

  const currentBook = bookMap[bookId];
  const currentChapter = currentBook?.c[chapter - 1];

  const transcripts = familyData?.transcripts || {};
  const journals = familyData?.journals || [];
  const bookmarks = familyData?.bookmarks || [];
  const completedList = familyData?.completed || [];
  const completedChapters = useMemo(() => new Set(completedList.map(c => c.key)), [completedList]);
  const activePlan = familyData?.activePlan || null;
  const dailyProverbs = !!familyData?.dailyProverbs;
  const prayers = familyData?.prayers || [];
  const comments = familyData?.comments || {};

  function chapterProgress(bId, ch) {
    const book = bookMap[bId];
    if (!book) return 0;
    const verses = book.c[ch - 1]?.v || [];
    if (verses.length === 0) return 0;
    let filled = 0;
    verses.forEach((_, i) => {
      const k = `${bId}-${ch}-${i + 1}`;
      if (transcripts[k]?.text && transcripts[k].text.trim().length > 0) filled++;
    });
    return filled / verses.length;
  }

  function updateTranscript(bId, ch, verseNum, text) {
    const k = `${bId}-${ch}-${verseNum}`;
    const newTranscripts = { ...transcripts };
    if (text && text.trim()) {
      newTranscripts[k] = { text, byUid: user.uid, updatedAt: new Date().toISOString() };
    } else {
      delete newTranscripts[k];
    }
    saveToCloud({ transcripts: newTranscripts });
  }

  function toggleChapterComplete(bId, ch) {
    const k = `${bId}-${ch}`;
    const existing = completedList.find(c => c.key === k);
    let newList;
    if (existing) {
      newList = completedList.filter(c => c.key !== k);
    } else {
      newList = [...completedList, { key: k, byUid: user.uid, completedAt: new Date().toISOString() }];
    }
    saveToCloud({ completed: newList });
  }

  function addJournal(content, jBookId, jChapter) {
    if (!content.trim()) return;
    const entry = {
      id: 'j_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: new Date().toISOString(),
      bookId: jBookId ?? bookId,
      chapter: jChapter ?? chapter,
      bookName: bookMap[jBookId ?? bookId]?.n,
      content: content.trim(),
      byUid: user.uid,
    };
    saveToCloud({ journals: [entry, ...journals] });
  }
  
  function updateJournal(id, newContent) {
    if (!newContent.trim()) return;
    const newJournals = journals.map(j =>
      j.id === id ? { ...j, content: newContent.trim(), updatedAt: new Date().toISOString() } : j
    );
    saveToCloud({ journals: newJournals });
  }

  function deleteJournal(id) {
    const newJournals = journals.filter(j => j.id !== id);
    const newComments = { ...comments };
    delete newComments[id];
    saveToCloud({ journals: newJournals, comments: newComments });
  }

  function toggleBookmark(bId, ch, verseNum) {
    const key = `${bId}-${ch}-${verseNum}`;
    const exists = bookmarks.find(b => b.key === key);
    let newList;
    if (exists) {
      newList = bookmarks.filter(b => b.key !== key);
    } else {
      const text = bookMap[bId]?.c[ch - 1]?.v[verseNum - 1] || '';
      newList = [{
        key, bookId: bId, chapter: ch, verse: verseNum,
        bookName: bookMap[bId]?.n, text,
        byUid: user.uid,
        createdAt: new Date().toISOString(),
      }, ...bookmarks];
    }
    saveToCloud({ bookmarks: newList });
  }
  function isBookmarked(bId, ch, vs) {
    return bookmarks.some(b => b.key === `${bId}-${ch}-${vs}`);
  }

  function addComment(targetId, text) {
    if (!text.trim()) return;
    const newComment = {
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      byUid: user.uid,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    const newComments = { ...comments };
    newComments[targetId] = [...(newComments[targetId] || []), newComment];
    saveToCloud({ comments: newComments });
  }
  function deleteComment(targetId, commentId) {
    const newComments = { ...comments };
    if (newComments[targetId]) {
      newComments[targetId] = newComments[targetId].filter(c => c.id !== commentId);
      if (newComments[targetId].length === 0) delete newComments[targetId];
    }
    saveToCloud({ comments: newComments });
  }

  // 기도제목
  function addPrayer(title, year, month) {
    const entry = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: title.trim(),
      status: 'progress', // progress | answered | unanswered
      byUid: user.uid,
      createdAt: new Date().toISOString(),
      year, month,
    };
    saveToCloud({ prayers: [entry, ...prayers] });
  }
  function updatePrayerStatus(id, status) {
    const newList = prayers.map(p =>
      p.id === id
        ? { ...p, status, statusUpdatedAt: new Date().toISOString(), ...(status === 'answered' ? { answeredAt: new Date().toISOString() } : {}) }
        : p
    );
    saveToCloud({ prayers: newList });
  }
  function updatePrayerTitle(id, newTitle) {
    if (!newTitle.trim()) return;
    const newList = prayers.map(p =>
      p.id === id ? { ...p, title: newTitle.trim(), updatedAt: new Date().toISOString() } : p
    );
    saveToCloud({ prayers: newList });
  }  
  function deletePrayer(id) {
    const newPrayers = prayers.filter(p => p.id !== id);
    const newComments = { ...comments };
    delete newComments[id];
    saveToCloud({ prayers: newPrayers, comments: newComments });
  }

  // 검색
  const searchResults = useMemo(() => {
    if (!bible || !searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.trim();
    const results = [];
    for (const b of bible.books) {
      for (let ci = 0; ci < b.c.length; ci++) {
        const verses = b.c[ci].v;
        for (let vi = 0; vi < verses.length; vi++) {
          if (verses[vi].includes(q)) {
            results.push({ bookId: b.id, bookName: b.n, chapter: ci + 1, verse: vi + 1, text: verses[vi] });
            if (results.length >= 100) return results;
          }
        }
      }
    }
    return results;
  }, [bible, searchQuery]);

  const stats = useMemo(() => {
    if (!bible) return { totalChapters: 0, completedCount: 0, transcribedVerses: 0, journalCount: 0, prayerCount: 0, answeredCount: 0 };
    const totalChapters = bible.books.reduce((s, b) => s + b.c.length, 0);
    const transcribedVerses = Object.values(transcripts).filter(t => t?.text && t.text.trim()).length;
    return {
      totalChapters,
      completedCount: completedChapters.size,
      transcribedVerses,
      journalCount: journals.length,
      prayerCount: prayers.length,
      answeredCount: prayers.filter(p => p.status === 'answered').length,
    };
  }, [bible, completedChapters, transcripts, journals, prayers]);

  const planInfo = useMemo(() => {
    if (!activePlan || !bible) return null;
    const schedule = generatePlanSchedule(activePlan.preset, chapterCountIndex, activePlan.startBookId);
    const dayIndex = daysBetween(activePlan.startDate, todayKST());
    return { schedule, dayIndex, totalDays: activePlan.preset.days };
  }, [activePlan, bible, chapterCountIndex]);

  const todayProverbsCh = getTodayProverbsChapter();

  async function handleLogout() {
    try { await signOut(auth); } catch (err) { console.error(err); }
  }

  async function handleLeaveFamily() {
    if (!confirm('정말 가족방을 떠나시겠습니까?\n작성한 데이터는 가족방에 남아있습니다.')) return;
    try {
      const member = familyData.members.find(m => m.uid === user.uid);
      if (member) {
        await updateDoc(familyDocRef, {
          members: arrayRemove(member),
        });
      }
      await setDoc(doc(db, 'userFamilies', user.uid), { familyId: null });
      onLeaveFamily();
    } catch (err) {
      alert('나가기 실패: ' + err.message);
    }
  }

  function startWriting(bId, ch) {
    setBookId(bId);
    setChapter(ch);
    setView('write');
  }

  if (bibleLoading || dataLoading) {
    return (
      <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-stone-300 border-t-stone-900 rounded-full animate-spin mb-4"></div>
          <p className="text-stone-500 text-sm">{bibleLoading ? '성경을 불러오는 중...' : '가족 데이터 동기화 중...'}</p>
        </div>
      </div>
    );
  }

  if (!bible) {
    return (
      <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div className="max-w-md w-full text-center">
          <p className="mb-4 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">⚠️ {loadError}</p>
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-stone-900 text-white py-3 rounded-xl">
            성경 파일 업로드
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
        </div>
      </div>
    );
  }

  // 필사 모드 (전체 화면)
  if (view === 'write' && currentChapter) {
    return (
      <WriteView
        book={currentBook}
        chapterNum={chapter}
        chapterData={currentChapter}
        transcripts={transcripts}
        updateTranscript={(vn, txt) => updateTranscript(bookId, chapter, vn, txt)}
        isCompleted={completedChapters.has(`${bookId}-${chapter}`)}
        onToggleComplete={() => toggleChapterComplete(bookId, chapter)}
        completedBy={completedList.find(c => c.key === `${bookId}-${chapter}`)?.byUid}
        onClose={() => setView('read')}
        onPrevChapter={() => {
          if (chapter > 1) setChapter(chapter - 1);
          else {
            const idx = BOOK_ORDER.indexOf(bookId);
            if (idx > 0) { setBookId(BOOK_ORDER[idx - 1]); setChapter(bookMap[BOOK_ORDER[idx - 1]].c.length); }
          }
        }}
        onNextChapter={() => {
          if (chapter < currentBook.c.length) setChapter(chapter + 1);
          else {
            const idx = BOOK_ORDER.indexOf(bookId);
            if (idx < BOOK_ORDER.length - 1) { setBookId(BOOK_ORDER[idx + 1]); setChapter(1); }
          }
        }}
        onAddJournal={addJournal}
        chapterJournals={journals.filter(j => j.bookId === bookId && j.chapter === chapter)}
        getUserColor={getUserColor}
        getUserInfo={getUserInfo}
        fontSizeIdx={fontSizeIdx}
        setFontSizeIdx={setFontSizeIdx}
        currentUid={user.uid}
        comments={comments}
        addComment={addComment}
        deleteComment={deleteComment}
        onDeleteJournal={deleteJournal}
        onUpdateJournal={updateJournal}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-stone-50 text-stone-900" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {showSidebar && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowSidebar(false)}>
          <div className="absolute inset-0 bg-stone-900/40" />
          <div className="relative bg-white w-80 max-w-[85vw] h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="font-bold text-lg">목차</h2>
              <button onClick={() => setShowSidebar(false)} className="p-1.5 hover:bg-stone-100 rounded-lg"><X size={20} /></button>
            </div>
            <BookList
              bible={bible}
              currentBookId={bookId}
              currentChapter={chapter}
              onSelect={(bId, ch) => { setBookId(bId); setChapter(ch); setShowSidebar(false); setView('read'); }}
              chapterProgress={chapterProgress}
              completedChapters={completedChapters}
            />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-stone-50/90 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button onClick={() => setShowSidebar(true)} className="p-2 -ml-2 hover:bg-stone-100 rounded-lg">
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <div className="flex-1 text-center min-w-0">
            <h1 className="text-base font-semibold tracking-tight truncate">
              {view === 'read' && currentBook && `${currentBook.n} ${chapter}장`}
              {view === 'plan' && '독서 계획'}
              {view === 'journal' && '묵상 일기'}
              {view === 'prayer' && '기도제목'}
              {view === 'settings' && '가족방 설정'}
            </h1>
            {view === 'read' && familyData?.name && (
              <div className="text-[10px] text-stone-400">{familyData.name} · {familyData.members?.length}명</div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {view === 'read' && (
              <FontSizeButton fontSizeIdx={fontSizeIdx} setFontSizeIdx={setFontSizeIdx} />
            )}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 rounded-full overflow-hidden ml-1 border-2 hover:ring-2 transition-all"
                style={{ borderColor: myColor.border, backgroundColor: myColor.bg }}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: myColor.text }}>
                    {user.displayName?.[0] || user.email?.[0] || '?'}
                  </div>
                )}
              </button>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-40 min-w-[240px] overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-100">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: myColor.border }} />
                        <span className="font-semibold text-sm truncate">{user.displayName || '사용자'}</span>
                      </div>
                      <div className="text-xs text-stone-500 truncate">{user.email}</div>
                    </div>
                    <div className="px-4 py-2 text-xs text-stone-500 flex items-center gap-1.5 border-b border-stone-100">
                      {syncStatus === 'syncing' && (<><Cloud size={14} className="text-stone-400 animate-pulse" /> 동기화 중...</>)}
                      {syncStatus === 'synced' && (<><Cloud size={14} className="text-emerald-500" /> 동기화됨</>)}
                      {syncStatus === 'error' && (<><CloudOff size={14} className="text-red-500" /> 동기화 오류</>)}
                      {syncStatus === 'idle' && (<><Cloud size={14} className="text-stone-400" /> 클라우드 연결됨</>)}
                    </div>
                    <button
                      onClick={() => { setShowUserMenu(false); setView('settings'); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <Users size={15} /> 가족방 설정
                    </button>
                    <button onClick={() => { setShowUserMenu(false); handleLogout(); }} className="w-full px-4 py-2.5 text-left text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2">
                      <LogOut size={15} /> 로그아웃
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-32">
        {view === 'read' && currentChapter && (
          <ReadView
            book={currentBook}
            chapterNum={chapter}
            chapterData={currentChapter}
            isCompleted={completedChapters.has(`${bookId}-${chapter}`)}
            chapterProgressPct={chapterProgress(bookId, chapter)}
            onStartWriting={() => setView('write')}
            onPrevChapter={() => {
              if (chapter > 1) setChapter(chapter - 1);
              else {
                const idx = BOOK_ORDER.indexOf(bookId);
                if (idx > 0) { setBookId(BOOK_ORDER[idx - 1]); setChapter(bookMap[BOOK_ORDER[idx - 1]].c.length); }
              }
            }}
            onNextChapter={() => {
              if (chapter < currentBook.c.length) setChapter(chapter + 1);
              else {
                const idx = BOOK_ORDER.indexOf(bookId);
                if (idx < BOOK_ORDER.length - 1) { setBookId(BOOK_ORDER[idx + 1]); setChapter(1); }
              }
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            onSelectSearchResult={(r) => { setBookId(r.bookId); setChapter(r.chapter); setSearchQuery(''); }}
            isBookmarked={isBookmarked}
            onToggleBookmark={(vs) => toggleBookmark(bookId, chapter, vs)}
            onShare={(verseNum) => setShareCard({
              bookName: currentBook.n, chapter, verse: verseNum, text: currentChapter.v[verseNum - 1]
            })}
            fontSizeClass={FONT_SIZES[fontSizeIdx].verseClass}
            chapterJournals={journals.filter(j => j.bookId === bookId && j.chapter === chapter)}
            onAddJournal={addJournal}
            getUserColor={getUserColor}
            getUserInfo={getUserInfo}
            currentUid={user.uid}
            comments={comments}
            addComment={addComment}
            deleteComment={deleteComment}
            onDeleteJournal={deleteJournal}
            onUpdateJournal={updateJournal}
          />
        )}

        {view === 'plan' && (
          <PlanView
            bible={bible}
            bookMap={bookMap}
            chapterCountIndex={chapterCountIndex}
            activePlan={activePlan}
            setActivePlan={(p) => saveToCloud({ activePlan: p })}
            dailyProverbs={dailyProverbs}
            setDailyProverbs={(v) => saveToCloud({ dailyProverbs: v })}
            todayProverbsCh={todayProverbsCh}
            completedChapters={completedChapters}
            onSelectChapter={(bId, ch) => startWriting(bId, ch)}
            stats={stats}
            planInfo={planInfo}
          />
        )}

        {view === 'journal' && (
          <JournalView
            journals={journals}
            bookMap={bookMap}
            onDelete={deleteJournal}
            onUpdate={updateJournal}
            onSelectChapter={(bId, ch) => { setBookId(bId); setChapter(ch); setView('read'); }}
            stats={stats}
            getUserColor={getUserColor}
            getUserInfo={getUserInfo}
            currentUid={user.uid}
            onAddJournal={addJournal}
            bible={bible}
            comments={comments}
            addComment={addComment}
            deleteComment={deleteComment}
          />
        )}

        {view === 'prayer' && (
          <PrayerView
            prayers={prayers}
            onAdd={addPrayer}
            onUpdateStatus={updatePrayerStatus}
            onUpdateTitle={updatePrayerTitle}
            onDelete={deletePrayer}
            getUserColor={getUserColor}
            getUserInfo={getUserInfo}
            currentUid={user.uid}
            comments={comments}
            addComment={addComment}
            deleteComment={deleteComment}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            familyData={familyData}
            familyId={familyId}
            currentUid={user.uid}
            getUserColor={getUserColor}
            onLeaveFamily={handleLeaveFamily}
            onChangeColor={async (colorId) => {
              const updatedMembers = familyData.members.map(m =>
                m.uid === user.uid ? { ...m, colorId } : m
              );
              await updateDoc(familyDocRef, { members: updatedMembers });
            }}
          />
        )}
      </main>

      {savedToast && (
        <div className="fixed bottom-24 right-4 z-50 bg-stone-900 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 animate-fade-in-out">
          <CheckCircle2 size={16} strokeWidth={2.5} className="text-emerald-400" />
          가족방에 저장됨
        </div>
      )}

      {shareCard && <ShareCardModal card={shareCard} onClose={() => setShareCard(null)} />}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          <NavBtn icon={<BookOpen size={20} strokeWidth={1.75} />} label="본문" active={view === 'read'} onClick={() => setView('read')} />
          <NavBtn icon={<Calendar size={20} strokeWidth={1.75} />} label="계획" active={view === 'plan'} onClick={() => setView('plan')} />
          <NavBtn icon={<NotebookPen size={20} strokeWidth={1.75} />} label="일기" active={view === 'journal'} onClick={() => setView('journal')} badge={journals.length} />
          <NavBtn icon={<Heart size={20} strokeWidth={1.75} />} label="기도" active={view === 'prayer'} onClick={() => setView('prayer')} badge={prayers.filter(p => p.status === 'progress').length} />
        </div>
      </nav>

      <style>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(10px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(10px); }
        }
        .animate-fade-in-out { animation: fadeInOut 1.5s ease-in-out; }
      `}</style>
    </div>
  );
}

// ============================================================
// 작은 컴포넌트들
// ============================================================
function FontSizeButton({ fontSizeIdx, setFontSizeIdx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 hover:bg-stone-100 rounded-lg flex items-center gap-0.5" title="글씨 크기">
        <Type size={16} strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-40 overflow-hidden min-w-[140px]">
            {FONT_SIZES.map((f, i) => (
              <button key={i} onClick={() => { setFontSizeIdx(i); setOpen(false); }} className={`w-full text-left px-4 py-2.5 hover:bg-stone-50 flex items-center justify-between transition-colors ${i === fontSizeIdx ? 'bg-stone-50' : ''}`}>
                <span className={f.verseClass}>가나다</span>
                <span className="text-xs text-stone-500">{f.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center py-3 gap-1 relative ${active ? 'text-stone-900' : 'text-stone-400'} hover:text-stone-700 transition-colors`}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
      {badge > 0 && (
        <span className="absolute top-2 right-1/2 translate-x-5 bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-stone-900 rounded-full" />}
    </button>
  );
}

function BookList({ bible, currentBookId, currentChapter, onSelect, chapterProgress, completedChapters }) {
  const [expandedBook, setExpandedBook] = useState(currentBookId);
  const otBooks = bible.books.filter(b => b.t === 'OT');
  const ntBooks = bible.books.filter(b => b.t === 'NT');
  function renderGroup(title, books) {
    return (
      <div className="mb-4">
        <h3 className="px-5 py-2 text-xs font-bold text-stone-400 uppercase tracking-wider">{title}</h3>
        <div>
          {books.map(b => {
            const isExpanded = expandedBook === b.id;
            const isCurrent = b.id === currentBookId;
            return (
              <div key={b.id}>
                <button onClick={() => setExpandedBook(isExpanded ? null : b.id)} className={`w-full flex items-center justify-between px-5 py-2.5 text-left text-sm transition-colors ${isCurrent ? 'bg-stone-100 font-semibold' : 'hover:bg-stone-50'}`}>
                  <span>{b.n}</span>
                  <span className="text-xs text-stone-400">{b.c.length}장</span>
                </button>
                {isExpanded && (
                  <div className="px-4 py-2 bg-stone-50 grid grid-cols-8 gap-1.5">
                    {b.c.map((_, i) => {
                      const ch = i + 1;
                      const prog = chapterProgress(b.id, ch);
                      const done = completedChapters.has(`${b.id}-${ch}`);
                      const isThis = b.id === currentBookId && ch === currentChapter;
                      return (
                        <button key={ch} onClick={() => onSelect(b.id, ch)} className={`relative aspect-square text-xs rounded-md font-medium transition-all
                          ${isThis ? 'bg-stone-900 text-white' : done ? 'bg-emerald-500 text-white' : prog > 0 ? 'bg-amber-100 text-stone-900' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}>
                          {ch}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="py-3">
      {renderGroup('구약', otBooks)}
      {renderGroup('신약', ntBooks)}
    </div>
  );
}

// ============================================================
// 본문 읽기 뷰
// ============================================================
function ReadView({ book, chapterNum, chapterData, isCompleted, chapterProgressPct, onStartWriting, onPrevChapter, onNextChapter, searchQuery, setSearchQuery, searchResults, onSelectSearchResult, isBookmarked, onToggleBookmark, onShare, fontSizeClass, chapterJournals, onAddJournal, onUpdateJournal, getUserColor, getUserInfo, currentUid, comments, addComment, deleteComment, onDeleteJournal }) {
  const verses = chapterData.v;
  const headings = chapterData.h || {};
  const pct = Math.round(chapterProgressPct * 100);
  const [journalDraft, setJournalDraft] = useState('');
  const [showJournalForm, setShowJournalForm] = useState(false);

  return (
    <div>
      <div className="mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="본문 검색 (예: 사랑, 평강)" className="w-full pl-10 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" />
          {searchQuery && (<button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"><X size={16} /></button>)}
        </div>
        {searchQuery && searchResults.length > 0 && (
          <div className="mt-2 bg-white border border-stone-200 rounded-xl max-h-80 overflow-y-auto shadow-sm">
            <div className="px-4 py-2 text-xs text-stone-500 border-b border-stone-100 sticky top-0 bg-white">검색 결과 {searchResults.length}건</div>
            {searchResults.slice(0, 50).map((r, i) => (
              <button key={i} onClick={() => onSelectSearchResult(r)} className="w-full text-left px-4 py-3 hover:bg-stone-50 border-b border-stone-50">
                <div className="text-xs font-semibold text-stone-500 mb-1">{r.bookName} {r.chapter}:{r.verse}</div>
                <div className="text-sm text-stone-800 line-clamp-2">{r.text}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={onStartWriting} className="w-full flex items-center justify-center gap-2 py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors mb-4">
        <PenLine size={18} strokeWidth={2} />
        <span>이 장 필사하기</span>
        {(isCompleted || pct > 0) && (
          <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${isCompleted ? 'bg-emerald-500' : 'bg-amber-500'}`}>
            {isCompleted ? '완료' : `${pct}%`}
          </span>
        )}
      </button>

      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8">
        <div className="space-y-5">
          {verses.map((text, i) => {
            const verseNum = i + 1;
            const heading = headings[String(verseNum)];
            const bookmarked = isBookmarked(book.id, chapterNum, verseNum);
            return (
              <div key={verseNum}>
                {heading && (<h3 className="text-base font-bold text-stone-700 mb-3 mt-2 pb-2 border-b border-stone-200 tracking-tight">{heading}</h3>)}
                <div className="flex gap-3 group">
                  <span className="text-xs font-bold text-stone-400 mt-1.5 w-6 text-right shrink-0">{verseNum}</span>
                  <p className={`text-stone-800 leading-loose flex-1 ${fontSizeClass}`} style={{ wordBreak: 'keep-all' }}>{text}</p>
                  <div className="flex flex-col gap-0.5 shrink-0 -mt-0.5">
                    <button onClick={() => onToggleBookmark(verseNum)} className={`p-1.5 rounded-lg ${bookmarked ? 'text-amber-500' : 'text-stone-300 hover:text-stone-600'}`}>
                      <Star size={16} strokeWidth={2} fill={bookmarked ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={() => onShare(verseNum)} className="p-1.5 rounded-lg text-stone-300 hover:text-stone-600"><Share2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 묵상 영역 */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-stone-700">
            이 장의 묵상 기록 {chapterJournals.length > 0 && `(${chapterJournals.length})`}
          </h3>
        </div>
        {!showJournalForm ? (
          <button onClick={() => setShowJournalForm(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-stone-300 hover:border-stone-500 rounded-xl font-medium text-stone-600 transition-colors mb-4">
            <NotebookPen size={16} strokeWidth={1.75} /> 묵상 기록하기
          </button>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-4">
            <div className="text-xs text-stone-500 mb-3">{book.n} {chapterNum}장에 대한 묵상</div>
            <textarea value={journalDraft} onChange={e => setJournalDraft(e.target.value)} placeholder="이 말씀을 통해 받은 마음을 적어보세요…" rows={5} className="w-full bg-stone-50 border border-stone-100 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-stone-300 resize-none" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setShowJournalForm(false); setJournalDraft(''); }} className="flex-1 py-2.5 text-stone-600 hover:bg-stone-100 rounded-lg text-sm font-medium">취소</button>
              <button onClick={() => { onAddJournal(journalDraft, book.id, chapterNum); setJournalDraft(''); setShowJournalForm(false); }} disabled={!journalDraft.trim()} className="flex-1 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-30">저장</button>
            </div>
          </div>
        )}

        {chapterJournals.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-sm text-stone-400">
            아직 이 장에 대한 묵상이 없어요
          </div>
        ) : (
          <div className="space-y-3">
            {chapterJournals.map(j => (
              <JournalCard
                key={j.id}
                journal={j}
                getUserColor={getUserColor}
                getUserInfo={getUserInfo}
                currentUid={currentUid}
                comments={comments[j.id] || []}
                addComment={(text) => addComment(j.id, text)}
                deleteComment={(cid) => deleteComment(j.id, cid)}
                onDelete={() => onDeleteJournal(j.id)}
                onUpdate={(content) => onUpdateJournal(j.id, content)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        <button onClick={onPrevChapter} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-stone-200 rounded-xl font-medium text-stone-700 hover:bg-stone-50">
          <ChevronLeft size={18} /> 이전 장
        </button>
        <button onClick={onNextChapter} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-stone-200 rounded-xl font-medium text-stone-700 hover:bg-stone-50">
          다음 장 <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 필사 뷰 (전체 화면)
// ============================================================
function WriteView({ book, chapterNum, chapterData, isCompleted, chapterProgressPct, onStartWriting, onPrevChapter, onNextChapter, searchQuery, setSearchQuery, searchResults, onSelectSearchResult, isBookmarked, onToggleBookmark, onShare, chapterJournals, onAddJournal, onUpdateJournal, getUserColor, getUserInfo, currentUid, comments, addComment, deleteComment, onDeleteJournal }) {
  const [journalDraft, setJournalDraft] = useState('');
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [localDrafts, setLocalDrafts] = useState({}); // 로컬 입력 버퍼 (타이핑 중)
  const debounceTimers = useRef({});
  const verses = chapterData.v;
  const headings = chapterData.h || {};
  const fontSizeClass = FONT_SIZES[fontSizeIdx].verseClass;

  function handleInput(verseNum, text) {
    setLocalDrafts(prev => ({ ...prev, [verseNum]: text }));
    if (debounceTimers.current[verseNum]) clearTimeout(debounceTimers.current[verseNum]);
    debounceTimers.current[verseNum] = setTimeout(() => {
      updateTranscript(verseNum, text);
    }, 600);
  }

  function getDisplayValue(verseNum) {
    if (localDrafts[verseNum] !== undefined) return localDrafts[verseNum];
    const k = `${book.id}-${chapterNum}-${verseNum}`;
    return transcripts[k]?.text || '';
  }

  const filledCount = verses.filter((_, i) => {
    const val = getDisplayValue(i + 1);
    return val && val.trim();
  }).length;

  return (
    <div className="min-h-screen w-full bg-white text-stone-900" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-stone-100 rounded-lg flex items-center gap-1 text-sm font-medium text-stone-600">
            <ChevronLeft size={20} /> 본문
          </button>
          <div className="flex-1 text-center min-w-0">
            <div className="flex items-center justify-center gap-2">
              <PenLine size={14} strokeWidth={2} className="text-stone-400" />
              <h1 className="text-sm font-semibold tracking-tight truncate">{book.n} {chapterNum}장 필사</h1>
            </div>
            <div className="text-xs text-stone-400 mt-0.5">{filledCount} / {verses.length}절 ({Math.round(filledCount / verses.length * 100)}%)</div>
          </div>
          <div className="flex items-center gap-1">
            <FontSizeButton fontSizeIdx={fontSizeIdx} setFontSizeIdx={setFontSizeIdx} />
            <button onClick={onToggleComplete} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              <Check size={13} strokeWidth={2.5} />
              {isCompleted ? '완료' : '완료'}
            </button>
          </div>
        </div>
        <div className="h-1 bg-stone-100 overflow-hidden">
          <div className="h-full bg-stone-900 transition-all duration-500" style={{ width: `${verses.length ? (filledCount / verses.length * 100) : 0}%` }} />
        </div>
      </header>

      {isCompleted && completedBy && completedBy !== currentUid && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 flex items-center gap-2">
            <Check size={16} />
            {getUserInfo(completedBy)?.displayName || '가족'}님이 이 장을 완료로 표시했어요
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24">
        <div className="space-y-8">
          {verses.map((text, i) => {
            const verseNum = i + 1;
            const k = `${book.id}-${chapterNum}-${verseNum}`;
            const heading = headings[String(verseNum)];
            const rec = transcripts[k];
            const recBy = rec?.byUid;
            const recColor = recBy ? getUserColor(recBy) : null;
            const isFilled = !!(getDisplayValue(verseNum) && getDisplayValue(verseNum).trim());
            return (
              <div key={verseNum}>
                {heading && (<h3 className="text-base font-bold text-stone-700 mb-4 mt-4 pb-2 border-b border-stone-200 tracking-tight">{heading}</h3>)}
                <div className={`rounded-xl p-4 mb-2 border transition-colors ${isFilled ? 'bg-stone-50 border-stone-200' : 'bg-amber-50/50 border-amber-100'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-xs font-bold mt-1 w-5 text-right shrink-0 ${isFilled ? 'text-stone-400' : 'text-amber-600'}`}>{verseNum}</span>
                    <p className={`text-stone-700 leading-loose flex-1 ${fontSizeClass}`} style={{ wordBreak: 'keep-all' }}>{text}</p>
                    {isFilled && <Check size={14} strokeWidth={2.5} className="text-emerald-500 mt-1.5 shrink-0" />}
                  </div>
                </div>
                <textarea
                  value={getDisplayValue(verseNum)}
                  onChange={e => handleInput(verseNum, e.target.value)}
                  placeholder={`${verseNum}절을 따라 써보세요…`}
                  rows={3}
                  className={`w-full bg-white border-2 rounded-xl p-4 leading-loose text-stone-900 focus:outline-none resize-none transition-colors ${fontSizeClass}`}
                  style={{
                    wordBreak: 'keep-all',
                    borderColor: recColor ? recColor.border + '60' : '#e7e5e4',
                  }}
                />
                {recBy && recBy !== currentUid && (
                  <div className="text-xs mt-1 flex items-center gap-1" style={{ color: recColor?.text }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: recColor?.border }} />
                    {getUserInfo(recBy)?.displayName}님의 필사
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 묵상 섹션 */}
        <div className="mt-16 pt-8 border-t border-stone-200">
          <h3 className="text-sm font-bold text-stone-700 mb-3 px-1">
            이 장의 묵상 {chapterJournals.length > 0 && `(${chapterJournals.length})`}
          </h3>
          {!showJournalForm ? (
            <button onClick={() => setShowJournalForm(true)} className="w-full flex items-center justify-center gap-2 py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 mb-4">
              <NotebookPen size={18} strokeWidth={1.75} /> 오늘의 묵상 기록하기
            </button>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-4">
              <div className="text-xs text-stone-500 mb-3">{book.n} {chapterNum}장에 대한 묵상</div>
              <textarea value={journalDraft} onChange={e => setJournalDraft(e.target.value)} placeholder="이 말씀을 통해 받은 마음을 적어보세요…" rows={6} className="w-full bg-stone-50 border border-stone-100 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-stone-300 resize-none" />
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setShowJournalForm(false); setJournalDraft(''); }} className="flex-1 py-2.5 text-stone-600 hover:bg-stone-100 rounded-lg text-sm font-medium">취소</button>
                <button onClick={() => { onAddJournal(journalDraft, book.id, chapterNum); setJournalDraft(''); setShowJournalForm(false); }} disabled={!journalDraft.trim()} className="flex-1 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium disabled:opacity-30">저장</button>
              </div>
            </div>
          )}

          {chapterJournals.length > 0 && (
            <div className="space-y-3">
              {chapterJournals.map(j => (
                <JournalCard
                  key={j.id}
                  journal={j}
                  getUserColor={getUserColor}
                  getUserInfo={getUserInfo}
                  currentUid={currentUid}
                  comments={comments[j.id] || []}
                  addComment={(text) => addComment(j.id, text)}
                  deleteComment={(cid) => deleteComment(j.id, cid)}
                  onDelete={() => onDeleteJournal(j.id)}
                  onUpdate={(content) => onUpdateJournal(j.id, content)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-12">
          <button onClick={onPrevChapter} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-stone-200 rounded-xl font-medium text-stone-700 hover:bg-stone-50">
            <ChevronLeft size={18} /> 이전 장
          </button>
          <button onClick={onNextChapter} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-stone-200 rounded-xl font-medium text-stone-700 hover:bg-stone-50">
            다음 장 <ChevronRight size={18} />
          </button>
        </div>
      </main>
    </div>
  );
}

// ============================================================
// 묵상 카드 (공용)
// ============================================================
function JournalCard({ journal: j, getUserColor, getUserInfo, currentUid, comments, addComment, deleteComment, onDelete, onUpdate, onSelectChapter }) {
  const [commentDraft, setCommentDraft] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(j.content);
  const userColor = getUserColor(j.byUid);
  const userInfo = getUserInfo(j.byUid);
  const isMine = j.byUid === currentUid;

  function handleSaveEdit() {
    if (!editDraft.trim()) return;
    onUpdate(editDraft);
    setEditing(false);
  }

  return (
    <div className="rounded-2xl p-4 border-l-4" style={{ backgroundColor: userColor.light, borderColor: userColor.border }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: userColor.border, color: 'white' }}>
            {userInfo?.photoURL ? (
              <img src={userInfo.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
            ) : ((userInfo?.displayName || '?')[0])}
          </div>
          <span className="text-sm font-semibold truncate" style={{ color: userColor.text }}>
            {userInfo?.displayName || '사용자'}
          </span>
          {onSelectChapter && j.bookName && (
            <button onClick={() => onSelectChapter(j.bookId, j.chapter)} className="text-xs font-semibold hover:underline shrink-0" style={{ color: userColor.text }}>
              · {j.bookName} {j.chapter}장
            </button>
          )}
          <span className="text-xs text-stone-500 shrink-0">
            · {new Date(j.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {j.updatedAt && j.updatedAt !== j.date && (
            <span className="text-[10px] text-stone-400 shrink-0">(수정됨)</span>
          )}
        </div>
        {isMine && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setEditing(true); setEditDraft(j.content); }} className="p-1.5 text-stone-400 hover:text-stone-700" title="수정">
              <Edit2 size={13} />
            </button>
            <button onClick={() => { if (confirm('이 묵상을 삭제하시겠습니까?')) onDelete(); }} className="p-1.5 text-stone-400 hover:text-red-500" title="삭제">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={editDraft}
            onChange={e => setEditDraft(e.target.value)}
            rows={5}
            className="w-full bg-white border rounded-lg p-3 text-sm leading-relaxed focus:outline-none resize-none"
            style={{ borderColor: userColor.border + '60', wordBreak: 'keep-all' }}
            autoFocus
          />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-stone-600 hover:bg-white rounded-lg">취소</button>
            <button onClick={handleSaveEdit} disabled={!editDraft.trim()} className="px-4 py-1.5 text-xs text-white rounded-lg font-medium disabled:opacity-30" style={{ backgroundColor: userColor.border }}>
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[14px] text-stone-800 whitespace-pre-wrap leading-relaxed mb-2" style={{ wordBreak: 'keep-all' }}>
          {j.content}
        </p>
      )}

      {!editing && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: userColor.border + '30' }}>
          {comments.length > 0 && (
            <div className="space-y-2 mb-2">
              {(showComments ? comments : comments.slice(-2)).map(c => {
                const cColor = getUserColor(c.byUid);
                const cInfo = getUserInfo(c.byUid);
                const cIsMine = c.byUid === currentUid;
                return (
                  <div key={c.id} className="flex items-start gap-2 text-xs">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5" style={{ backgroundColor: cColor.border, color: 'white' }}>
                      {(cInfo?.displayName || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold" style={{ color: cColor.text }}>{cInfo?.displayName || '사용자'}</span>
                      <span className="text-stone-500 ml-1.5">{new Date(c.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <div className="text-stone-700 mt-0.5" style={{ wordBreak: 'keep-all' }}>{c.text}</div>
                    </div>
                    {cIsMine && (<button onClick={() => deleteComment(c.id)} className="text-stone-300 hover:text-red-500 shrink-0"><X size={12} /></button>)}
                  </div>
                );
              })}
              {!showComments && comments.length > 2 && (
                <button onClick={() => setShowComments(true)} className="text-xs text-stone-500 hover:text-stone-700">
                  댓글 {comments.length - 2}개 더 보기
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="text" value={commentDraft} onChange={e => setCommentDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && commentDraft.trim()) { addComment(commentDraft); setCommentDraft(''); } }}
              placeholder="댓글 쓰기…" className="flex-1 bg-white/60 border border-stone-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-stone-400" />
            {commentDraft.trim() && (
              <button onClick={() => { addComment(commentDraft); setCommentDraft(''); }} className="p-1.5 rounded-full" style={{ backgroundColor: userColor.border, color: 'white' }}>
                <Send size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 계획 뷰 (기존 구조 대부분 재사용)
// ============================================================
function PlanView({ bible, bookMap, chapterCountIndex, activePlan, setActivePlan, dailyProverbs, setDailyProverbs, todayProverbsCh, completedChapters, onSelectChapter, stats, planInfo }) {
  const proverbsCard = dailyProverbs && (
    <DailyProverbsCard
      todayProverbsCh={todayProverbsCh}
      completedChapters={completedChapters}
      onSelect={() => onSelectChapter(120, todayProverbsCh > 30 ? 30 : todayProverbsCh)}
      onToggleOff={() => setDailyProverbs(false)}
    />
  );
  if (activePlan && planInfo) {
    return <ActivePlanView
      activePlan={activePlan} planInfo={planInfo} bookMap={bookMap}
      completedChapters={completedChapters} onSelectChapter={onSelectChapter}
      onCancelPlan={() => { if (confirm('진행 중인 계획을 취소하시겠습니까?')) setActivePlan(null); }}
      stats={stats} proverbsCard={proverbsCard}
    />;
  }
  return <PlanSelectorView
    bible={bible} bookMap={bookMap} chapterCountIndex={chapterCountIndex}
    onStart={(planConfig) => setActivePlan(planConfig)}
    dailyProverbs={dailyProverbs} setDailyProverbs={setDailyProverbs}
    todayProverbsCh={todayProverbsCh} completedChapters={completedChapters}
    onSelectChapter={onSelectChapter} stats={stats} proverbsCard={proverbsCard}
  />;
}

function DailyProverbsCard({ todayProverbsCh, completedChapters, onSelect, onToggleOff }) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  const targetChapter = todayProverbsCh;
  const done = completedChapters.has(`120-${targetChapter}`);
  const dateStr = `${kst.getMonth() + 1}월 ${kst.getDate()}일`;
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 mb-6 relative">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0"><Sunrise size={18} strokeWidth={2} /></div>
          <div className="min-w-0">
            <div className="font-bold text-sm tracking-tight text-stone-900">매일 잠언</div>
            <div className="text-xs text-stone-500">{dateStr}</div>
          </div>
        </div>
        <button onClick={onToggleOff} className="text-xs text-stone-400 hover:text-stone-700 px-2 py-1 rounded-md">끄기</button>
      </div>
      <button onClick={onSelect} className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${done ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white border-amber-200 hover:border-amber-400'}`}>
        <div className="text-left min-w-0">
          <div className={`text-xs font-medium mb-0.5 ${done ? 'text-emerald-50' : 'text-stone-500'}`}>{done ? '오늘 분량 완료!' : '오늘 필사할 분량'}</div>
          <div className={`text-lg font-bold ${done ? 'text-white' : 'text-stone-900'}`}>잠언 {targetChapter}장</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {done && <Check size={18} strokeWidth={2.5} />}
          <ChevronRight size={18} className={done ? 'text-white' : 'text-stone-400'} />
        </div>
      </button>
    </div>
  );
}

function ActivePlanView({ activePlan, planInfo, bookMap, completedChapters, onSelectChapter, onCancelPlan, stats, proverbsCard }) {
  const { schedule, dayIndex, totalDays } = planInfo;
  const progress = Math.max(0, Math.min(dayIndex + 1, totalDays));
  const totalChaptersInPlan = schedule.reduce((s, d) => s + d.length, 0);
  const completedInPlan = schedule.flat().filter(c => completedChapters.has(`${c.bookId}-${c.chapter}`)).length;
  const endDate = addDays(activePlan.startDate, totalDays - 1);
  const showDays = [];
  for (let d = Math.max(0, dayIndex - 2); d < Math.min(totalDays, dayIndex + 7); d++) showDays.push(d);
  return (
    <div>
      <PlanStatsBar stats={stats} />
      <div className="mt-6">{proverbsCard}</div>
      <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-stone-500 mb-1">진행 중인 계획</div>
            <div className="text-lg font-bold tracking-tight">{activePlan.preset.name}</div>
          </div>
          <button onClick={onCancelPlan} className="text-xs text-stone-400 hover:text-red-500 px-2 py-1 rounded-md">계획 취소</button>
        </div>
        <div className="flex items-end justify-between mb-2">
          <div><div className="text-xs text-stone-500">날짜 진행</div><div className="text-2xl font-bold">{progress} <span className="text-sm font-normal text-stone-400">/ {totalDays}일</span></div></div>
          <div className="text-right"><div className="text-xs text-stone-500">필사 완료</div><div className="text-2xl font-bold">{completedInPlan} <span className="text-sm font-normal text-stone-400">/ {totalChaptersInPlan}장</span></div></div>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-3"><div className="h-full bg-stone-900 transition-all" style={{ width: `${(progress / totalDays) * 100}%` }} /></div>
        <div className="flex justify-between text-xs text-stone-400"><span>시작: {activePlan.startDate}</span><span>종료 예정: {endDate}</span></div>
      </div>
      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 px-1">필사 일정</h3>
      <div className="space-y-3">
        {showDays.map(d => {
          const dayChapters = schedule[d] || [];
          const date = addDays(activePlan.startDate, d);
          const dateObj = new Date(date + 'T00:00:00');
          const isToday = d === dayIndex;
          const isPast = d < dayIndex;
          const allDone = dayChapters.length > 0 && dayChapters.every(c => completedChapters.has(`${c.bookId}-${c.chapter}`));
          return (
            <div key={d} className={`bg-white border rounded-2xl p-4 ${isToday ? 'border-stone-900 ring-2 ring-stone-900/10' : 'border-stone-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isToday ? 'bg-stone-900 text-white' : isPast ? 'bg-stone-100 text-stone-500' : 'bg-amber-50 text-amber-700'}`}>
                    {isToday ? '오늘' : isPast ? '지남' : `D+${d - dayIndex}`}
                  </span>
                  <span className="text-sm font-semibold">Day {d + 1}</span>
                  <span className="text-xs text-stone-400">{dateObj.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                </div>
                {allDone && <span className="text-emerald-600 text-xs font-bold flex items-center gap-1"><Check size={14} strokeWidth={2.5} /> 완료</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {dayChapters.map((c, i) => {
                  const book = bookMap[c.bookId];
                  if (!book) return null;
                  const done = completedChapters.has(`${c.bookId}-${c.chapter}`);
                  return (
                    <button key={i} onClick={() => onSelectChapter(c.bookId, c.chapter)} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${done ? 'bg-emerald-500 text-white' : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200'}`}>
                      {!done && <PenLine size={12} strokeWidth={2} />}
                      {book.n} {c.chapter}장
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanStatsBar({ stats }) {
  const items = [
    { label: '필사 절', value: stats.transcribedVerses.toLocaleString() },
    { label: '완료 장', value: `${stats.completedCount} / ${stats.totalChapters}` },
    { label: '묵상', value: stats.journalCount },
    { label: '기도', value: `${stats.answeredCount} / ${stats.prayerCount}` },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((it, i) => (
        <div key={i} className="bg-white border border-stone-200 rounded-xl p-3">
          <div className="text-xs text-stone-400 mb-1">{it.label}</div>
          <div className="text-lg font-bold">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function PlanSelectorView({ bible, bookMap, chapterCountIndex, onStart, dailyProverbs, setDailyProverbs, todayProverbsCh, completedChapters, onSelectChapter, stats, proverbsCard }) {
  const [mode, setMode] = useState(null);
  const [selectedFocusPreset, setSelectedFocusPreset] = useState(null);
  if (mode === 'full') return <FullPlanBuilder bible={bible} bookMap={bookMap} chapterCountIndex={chapterCountIndex} onCancel={() => setMode(null)} onStart={onStart} />;
  if (mode === 'focus' && selectedFocusPreset) return <FocusPlanConfig preset={selectedFocusPreset} bookMap={bookMap} chapterCountIndex={chapterCountIndex} onCancel={() => { setSelectedFocusPreset(null); setMode(null); }} onStart={onStart} />;
  if (mode === 'custom') return <CustomPlanBuilder bible={bible} bookMap={bookMap} chapterCountIndex={chapterCountIndex} onCancel={() => setMode(null)} onCreate={(preset) => { onStart({ preset, startDate: todayKST(), startBookId: preset.books[0], startedAt: new Date().toISOString() }); }} />;
  return (
    <div>
      <PlanStatsBar stats={stats} />
      <div className="mt-6">{proverbsCard}</div>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-100 text-stone-700 mb-3"><Calendar size={26} strokeWidth={1.5} /></div>
        <h2 className="text-xl font-bold tracking-tight mb-1">새 계획 시작하기</h2>
        <p className="text-stone-500 text-sm">목적에 맞는 계획을 선택하세요</p>
      </div>
      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 px-1">통독 계획</h3>
      <button onClick={() => setMode('full')} className="w-full bg-white border border-stone-200 hover:border-stone-400 rounded-2xl p-5 transition-colors text-left flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="font-semibold text-base text-stone-900 mb-1 flex items-center gap-2"><BookOpen size={18} strokeWidth={1.75} className="text-stone-700" />성경 전체 통독</div>
          <div className="text-xs text-stone-500 leading-relaxed">66권 · 1,189장 전체를 읽어요<br/><span className="text-stone-400">시작 책과 기간을 직접 선택</span></div>
        </div>
        <ChevronRight size={20} className="text-stone-300 shrink-0" />
      </button>
      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 px-1">매일 반복</h3>
      {!dailyProverbs ? (
        <button onClick={() => setDailyProverbs(true)} className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-400 rounded-2xl p-5 transition-colors text-left flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0"><Sunrise size={22} strokeWidth={2} /></div>
            <div className="min-w-0">
              <div className="font-semibold text-base text-stone-900 mb-0.5">매일 잠언</div>
              <div className="text-xs text-stone-600 leading-relaxed">매일 날짜에 해당하는 잠언 한 장씩</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-amber-600 shrink-0" />
        </button>
      ) : (<div className="mb-6 text-center text-xs text-stone-500 py-3">✨ 매일 잠언이 켜져 있어요</div>)}
      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 px-1">집중 계획</h3>
      <div className="space-y-2 mb-6">
        {FOCUS_PRESETS.map(p => (<PresetCard key={p.id} preset={p} bookMap={bookMap} chapterCountIndex={chapterCountIndex} onClick={() => { setSelectedFocusPreset(p); setMode('focus'); }} />))}
      </div>
      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 px-1">커스텀</h3>
      <button onClick={() => setMode('custom')} className="w-full bg-white border-2 border-dashed border-stone-300 hover:border-stone-500 rounded-2xl p-4 transition-colors flex items-center justify-center gap-2 text-stone-600">
        <Plus size={18} strokeWidth={2} /><span className="font-medium text-sm">직접 계획 만들기</span>
      </button>
    </div>
  );
}

function FullPlanBuilder({ bible, bookMap, chapterCountIndex, onCancel, onStart }) {
  const [startBookId, setStartBookId] = useState(101);
  const [days, setDays] = useState(365);
  const [customDays, setCustomDays] = useState('');
  const [startDate, setStartDate] = useState(todayKST());
  const realDays = customDays ? Math.max(1, parseInt(customDays) || days) : days;
  const totalCh = bible.books.reduce((s, b) => s + b.c.length, 0);
  const perDay = (totalCh / realDays).toFixed(1);
  const endDate = addDays(startDate, realDays - 1);
  const startBook = bookMap[startBookId];
  function formatDuration(d) {
    if (d % 365 === 0 && d >= 365) return `${d / 365}년`;
    if (d % 30 === 0 && d >= 30) return `${d / 30}개월`;
    return `${d}일`;
  }
  function handleStart() {
    const preset = { id: `full_custom_${Date.now()}`, type: 'full', name: `${startBook.n}부터 ${formatDuration(realDays)} 통독`, books: BOOK_ORDER, days: realDays };
    onStart({ preset, startDate, startBookId, startedAt: new Date().toISOString() });
  }
  return (
    <div>
      <button onClick={onCancel} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-4"><ChevronLeft size={16} /> 다른 계획 선택</button>
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1"><BookOpen size={20} strokeWidth={1.75} className="text-stone-700" /><h2 className="text-xl font-bold tracking-tight">성경 전체 통독</h2></div>
        <p className="text-sm text-stone-500 mb-6">66권 · 1,189장 전체</p>
        <div className="mb-5">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">시작 책</label>
          <select value={startBookId} onChange={e => setStartBookId(Number(e.target.value))} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-stone-400">
            <optgroup label="구약 (39권)">{bible.books.filter(b => b.t === 'OT').map(b => <option key={b.id} value={b.id}>{b.n}</option>)}</optgroup>
            <optgroup label="신약 (27권)">{bible.books.filter(b => b.t === 'NT').map(b => <option key={b.id} value={b.id}>{b.n}</option>)}</optgroup>
          </select>
          <p className="text-xs text-stone-400 mt-1.5">{startBook?.n}부터 시작하여 전체 66권 완독</p>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">기간</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {FULL_DURATION_PRESETS.map(p => (<button key={p.days} onClick={() => { setDays(p.days); setCustomDays(''); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!customDays && days === p.days ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-700 border border-stone-200'}`}>{p.label}</button>))}
          </div>
          <input type="number" value={customDays} onChange={e => setCustomDays(e.target.value)} placeholder="또는 직접 입력 (일)" min={1} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stone-400" />
        </div>
        <div className="mb-5">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">시작일</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-stone-400" />
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-5 text-center">
          <div className="text-xs text-stone-500 mb-1">예상 일정</div>
          <div className="text-base font-bold text-stone-900 mb-1">하루 평균 {perDay}장</div>
          <div className="text-xs text-stone-500">{startDate} → {endDate} ({realDays}일)</div>
        </div>
        <button onClick={handleStart} disabled={realDays < 1} className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 disabled:opacity-30">계획 시작하기</button>
      </div>
    </div>
  );
}

function FocusPlanConfig({ preset, bookMap, chapterCountIndex, onCancel, onStart }) {
  const [startDate, setStartDate] = useState(todayKST());
  const totalCh = preset.books.reduce((s, bid) => s + (chapterCountIndex[bid] || 0), 0);
  const perDay = (totalCh / preset.days).toFixed(1);
  const endDate = addDays(startDate, preset.days - 1);
  return (
    <div>
      <button onClick={onCancel} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-4"><ChevronLeft size={16} /> 다른 계획 선택</button>
      <div className="bg-white border border-stone-200 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-1 tracking-tight">{preset.name}</h2>
        <p className="text-sm text-stone-500 mb-6">총 {totalCh}장 · {preset.days}일 · 하루 평균 {perDay}장</p>
        <div className="mb-5">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">시작일</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-stone-400" />
          <p className="text-xs text-stone-400 mt-1.5">종료 예정: {endDate}</p>
        </div>
        <div className="mb-6">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">포함된 책 ({preset.books.length}권)</label>
          <div className="bg-stone-50 rounded-lg p-3 max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {preset.books.map(bid => { const b = bookMap[bid]; if (!b) return null; return <span key={bid} className="text-xs bg-white border border-stone-200 px-2 py-1 rounded-md text-stone-700">{b.n}</span>; })}
            </div>
          </div>
        </div>
        <button onClick={() => onStart({ preset, startDate, startBookId: preset.books[0], startedAt: new Date().toISOString() })} className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800">계획 시작하기</button>
      </div>
    </div>
  );
}

function PresetCard({ preset, bookMap, chapterCountIndex, onClick }) {
  const totalCh = preset.books.reduce((s, bid) => s + (chapterCountIndex[bid] || 0), 0);
  const perDay = (totalCh / preset.days).toFixed(1);
  return (
    <button onClick={onClick} className="w-full bg-white border border-stone-200 hover:border-stone-400 rounded-2xl p-4 transition-colors text-left flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-sm text-stone-900 mb-0.5">{preset.name}</div>
        <div className="text-xs text-stone-500">{preset.days}일 · {totalCh}장 · 하루 평균 {perDay}장</div>
      </div>
      <ChevronRight size={18} className="text-stone-300 shrink-0" />
    </button>
  );
}

function CustomPlanBuilder({ bible, bookMap, chapterCountIndex, onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [selectedBooks, setSelectedBooks] = useState(new Set());
  const [days, setDays] = useState(30);
  const [customDays, setCustomDays] = useState('');
  const totalCh = [...selectedBooks].reduce((s, bid) => s + (chapterCountIndex[bid] || 0), 0);
  const realDays = customDays ? parseInt(customDays) || days : days;
  const perDay = realDays > 0 ? (totalCh / realDays).toFixed(1) : 0;
  function toggleBook(bid) { setSelectedBooks(prev => { const next = new Set(prev); if (next.has(bid)) next.delete(bid); else next.add(bid); return next; }); }
  function toggleAll(testament) {
    const ids = bible.books.filter(b => b.t === testament).map(b => b.id);
    const allSelected = ids.every(id => selectedBooks.has(id));
    setSelectedBooks(prev => { const next = new Set(prev); if (allSelected) ids.forEach(id => next.delete(id)); else ids.forEach(id => next.add(id)); return next; });
  }
  function handleCreate() {
    if (!name.trim() || selectedBooks.size === 0 || realDays < 1) return;
    const orderedBooks = BOOK_ORDER.filter(bid => selectedBooks.has(bid));
    const preset = { id: 'custom_' + Date.now(), type: 'custom', name: name.trim(), books: orderedBooks, days: realDays };
    onCreate(preset);
  }
  const otBooks = bible.books.filter(b => b.t === 'OT');
  const ntBooks = bible.books.filter(b => b.t === 'NT');
  return (
    <div>
      <button onClick={onCancel} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-4"><ChevronLeft size={16} /> 뒤로</button>
      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 tracking-tight">직접 계획 만들기</h2>
        <div className="mb-4">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">계획 이름</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="예: 나만의 신약 묵상" className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-stone-400" />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">기간</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {[7, 30, 60, 90, 180, 365].map(d => (<button key={d} onClick={() => { setDays(d); setCustomDays(''); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!customDays && days === d ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-700 border border-stone-200'}`}>{d < 365 ? `${d}일` : '1년'}</button>))}
          </div>
          <input type="number" value={customDays} onChange={e => setCustomDays(e.target.value)} placeholder="또는 직접 입력 (일)" min={1} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-stone-400" />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">포함할 책 ({selectedBooks.size}권)</label>
          <div className="bg-stone-50 rounded-lg p-3 mb-2 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-stone-600">구약 (39권)</span><button onClick={() => toggleAll('OT')} className="text-xs text-stone-500 underline">전체 선택/해제</button></div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-3">{otBooks.map(b => (<button key={b.id} onClick={() => toggleBook(b.id)} className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedBooks.has(b.id) ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>{b.n}</button>))}</div>
            <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-stone-600">신약 (27권)</span><button onClick={() => toggleAll('NT')} className="text-xs text-stone-500 underline">전체 선택/해제</button></div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">{ntBooks.map(b => (<button key={b.id} onClick={() => toggleBook(b.id)} className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedBooks.has(b.id) ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>{b.n}</button>))}</div>
          </div>
        </div>
        {selectedBooks.size > 0 && realDays > 0 && (<div className="bg-stone-50 border border-stone-200 rounded-lg p-3 mb-4 text-center"><div className="text-xs text-stone-500 mb-1">자동 계산</div><div className="text-sm font-medium">총 <span className="font-bold">{totalCh}</span>장 / <span className="font-bold">{realDays}</span>일 = 하루 평균 <span className="font-bold text-stone-900">{perDay}</span>장</div></div>)}
        <button onClick={handleCreate} disabled={!name.trim() || selectedBooks.size === 0 || realDays < 1} className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 disabled:opacity-30">만들기</button>
      </div>
    </div>
  );
}

// ============================================================
// 일기 탭
// ============================================================
function JournalView({ journals, bookMap, onDelete, onUpdate, onSelectChapter, stats, getUserColor, getUserInfo, currentUid, onAddJournal, bible, comments, addComment, deleteComment }) {
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [draft, setDraft] = useState('');
  const [quickBook, setQuickBook] = useState(101);
  const [quickChapter, setQuickChapter] = useState(1);

  const grouped = useMemo(() => {
    const g = {};
    journals.forEach(j => { const d = j.date.slice(0, 10); if (!g[d]) g[d] = []; g[d].push(j); });
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [journals]);

  function handleSubmit() {
    if (!draft.trim()) return;
    onAddJournal(draft, quickBook, quickChapter);
    setDraft('');
    setShowQuickForm(false);
  }

  return (
    <div>
      <PlanStatsBar stats={stats} />

      <div className="mt-6 mb-4">
        {!showQuickForm ? (
          <button onClick={() => setShowQuickForm(true)} className="w-full flex items-center justify-center gap-2 py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors">
            <Plus size={18} strokeWidth={2} /> 빠른 묵상 쓰기
          </button>
        ) : (
          <div className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">빠른 묵상</div>
            <div className="flex gap-2 mb-3">
              <select value={quickBook} onChange={e => { setQuickBook(Number(e.target.value)); setQuickChapter(1); }} className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm">
                <optgroup label="구약">{bible.books.filter(b => b.t === 'OT').map(b => <option key={b.id} value={b.id}>{b.n}</option>)}</optgroup>
                <optgroup label="신약">{bible.books.filter(b => b.t === 'NT').map(b => <option key={b.id} value={b.id}>{b.n}</option>)}</optgroup>
              </select>
              <select value={quickChapter} onChange={e => setQuickChapter(Number(e.target.value))} className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm">
                {Array.from({ length: bookMap[quickBook]?.c.length || 1 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}장</option>)}
              </select>
            </div>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="말씀 읽고 받은 마음이나 깨달음을 적어보세요…" rows={5} className="w-full bg-stone-50 border border-stone-100 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-stone-300 resize-none" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setShowQuickForm(false); setDraft(''); }} className="flex-1 py-2.5 text-stone-600 hover:bg-stone-100 rounded-lg text-sm font-medium">취소</button>
              <button onClick={handleSubmit} disabled={!draft.trim()} className="flex-1 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-30">저장</button>
            </div>
          </div>
        )}
      </div>

      {journals.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center mt-6">
          <NotebookPen size={32} className="mx-auto text-stone-300 mb-4" strokeWidth={1.25} />
          <p className="text-stone-500 text-sm leading-relaxed">아직 기록한 묵상이 없습니다.<br/>말씀 읽고 마음에 담긴 것을 기록해보세요.</p>
        </div>
      ) : (
        <div className="space-y-8 mt-6">
          {grouped.map(([date, entries]) => (
            <div key={date}>
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 px-1">
                {new Date(date + 'T00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </h3>
              <div className="space-y-3">
                {entries.map(j => (
                  <JournalCard
                    key={j.id}
                    journal={j}
                    getUserColor={getUserColor}
                    getUserInfo={getUserInfo}
                    currentUid={currentUid}
                    comments={comments[j.id] || []}
                    addComment={(text) => addComment(j.id, text)}
                    deleteComment={(cid) => deleteComment(j.id, cid)}
                    onDelete={() => onDelete(j.id)}
                    onUpdate={(content) => onUpdateJournal(j.id, content)}
                    onSelectChapter={onSelectChapter}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 기도제목 탭
// ============================================================
function PrayerView({ prayers, onAdd, onUpdateStatus, onUpdateTitle, onDelete, getUserColor, getUserInfo, currentUid, comments, addComment, deleteComment }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);

  const years = useMemo(() => {
    const s = new Set([now.getFullYear()]);
    prayers.forEach(p => s.add(p.year));
    return [...s].sort((a, b) => b - a);
  }, [prayers, now]);

  const filteredPrayers = prayers.filter(p => p.year === selectedYear);
  const byMonth = useMemo(() => {
    const m = {};
    filteredPrayers.forEach(p => {
      if (!m[p.month]) m[p.month] = [];
      m[p.month].push(p);
    });
    return Object.entries(m).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [filteredPrayers]);

  const yearStats = {
    total: filteredPrayers.length,
    answered: filteredPrayers.filter(p => p.status === 'answered').length,
    progress: filteredPrayers.filter(p => p.status === 'progress').length,
    unanswered: filteredPrayers.filter(p => p.status === 'unanswered').length,
  };

  function handleAdd() {
    if (!title.trim()) return;
    onAdd(title.trim(), formYear, formMonth);
    setTitle('');
    setShowForm(false);
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-stone-100 text-stone-700 mb-3">
          <Heart size={26} strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-1">기도제목</h2>
        <p className="text-stone-500 text-sm">함께 기도하고, 응답을 기록해요</p>
      </div>

      {/* 연도 탭 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {years.map(y => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${
              selectedYear === y ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* 연도 통계 */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <div className="bg-white border border-stone-200 rounded-xl p-2 text-center">
          <div className="text-[10px] text-stone-400">전체</div>
          <div className="text-base font-bold">{yearStats.total}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-center">
          <div className="text-[10px] text-emerald-600">응답</div>
          <div className="text-base font-bold text-emerald-700">{yearStats.answered}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
          <div className="text-[10px] text-amber-700">진행 중</div>
          <div className="text-base font-bold text-amber-700">{yearStats.progress}</div>
        </div>
        <div className="bg-stone-100 border border-stone-200 rounded-xl p-2 text-center">
          <div className="text-[10px] text-stone-500">응답 안됨</div>
          <div className="text-base font-bold text-stone-600">{yearStats.unanswered}</div>
        </div>
      </div>

      {/* 추가 버튼 */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="w-full flex items-center justify-center gap-2 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 mb-6">
          <Plus size={18} strokeWidth={2} /> 기도제목 추가
        </button>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6">
          <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">새 기도제목</div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: 시아버님 건강 회복"
            className="w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-stone-400"
          />
          <div className="flex gap-2 mb-3">
            <select value={formYear} onChange={e => setFormYear(Number(e.target.value))} className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm">
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select value={formMonth} onChange={e => setFormMonth(Number(e.target.value))} className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setTitle(''); }} className="flex-1 py-2.5 text-stone-600 hover:bg-stone-100 rounded-lg text-sm font-medium">취소</button>
            <button onClick={handleAdd} disabled={!title.trim()} className="flex-1 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium disabled:opacity-30">추가</button>
          </div>
        </div>
      )}

      {/* 월별 목록 */}
      {byMonth.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
          <Heart size={32} className="mx-auto text-stone-300 mb-4" strokeWidth={1.25} />
          <p className="text-stone-500 text-sm">{selectedYear}년에 등록된 기도제목이 없어요</p>
        </div>
      ) : (
        <div className="space-y-6">
          {byMonth.map(([month, items]) => (
            <div key={month}>
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 px-1">
                {month}월 · {items.length}개
              </h3>
              <div className="space-y-2">
                {items.map(p => (
                  <PrayerCard
                    key={p.id}
                    prayer={p}
                    getUserColor={getUserColor}
                    getUserInfo={getUserInfo}
                    currentUid={currentUid}
                    onUpdateStatus={(s) => onUpdateStatus(p.id, s)}
                    onUpdateTitle={(title) => onUpdateTitle(p.id, title)}
                    onDelete={() => onDelete(p.id)}
                    comments={comments[p.id] || []}
                    addComment={(text) => addComment(p.id, text)}
                    deleteComment={(cid) => deleteComment(p.id, cid)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrayerCard({ prayer: p, getUserColor, getUserInfo, currentUid, onUpdateStatus, onUpdateTitle, onDelete, comments, addComment, deleteComment }) 
{
  const [showDetail, setShowDetail] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(p.title);
  const userColor = getUserColor(p.byUid);
  const userInfo = getUserInfo(p.byUid);
  const isMine = p.byUid === currentUid;

  const STATUS_OPTIONS = [
    { key: 'done',     icon: '✓', label: '완료',   bg: '#10b981', text: 'white' },
    { key: 'progress', icon: '△', label: '진행중', bg: '#fbbf24', text: '#78350f' },
    { key: 'hold',     icon: '✕', label: '보류',   bg: '#e5e7eb', text: '#4b5563' },
  ];
  
  // 기존 데이터 호환: 'answered'→'done', 'unanswered'→'hold'
  const normalizedStatus = p.status === 'answered' ? 'done' : p.status === 'unanswered' ? 'hold' : p.status || 'progress';
  const currentStatus = STATUS_OPTIONS.find(s => s.key === normalizedStatus) || STATUS_OPTIONS[1];

  function handleSaveEdit() {
    if (!editDraft.trim()) return;
    onUpdateTitle(editDraft);
    setEditing(false);
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-visible">
      <div className="p-4 flex items-start gap-3">
        {/* 상태 아이콘 + 팝업 메뉴 */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-base transition-all hover:scale-110"
            style={{ backgroundColor: currentStatus.bg, color: currentStatus.text }}
            title="상태 변경"
          >
            {currentStatus.icon}
          </button>
          {showStatusMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowStatusMenu(false)} />
              <div className="absolute top-full left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-40 min-w-[140px] overflow-hidden">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => { onUpdateStatus(opt.key); setShowStatusMenu(false); }}
                    className={`w-full px-3 py-2.5 flex items-center gap-2 hover:bg-stone-50 ${normalizedStatus === opt.key ? 'bg-stone-50' : ''}`}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs" style={{ backgroundColor: opt.bg, color: opt.text }}>
                      {opt.icon}
                    </div>
                    <span className="text-sm text-stone-700">{opt.label}</span>
                    {normalizedStatus === opt.key && <Check size={14} className="ml-auto text-stone-500" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div>
              <input
                type="text"
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:border-stone-500"
                autoFocus
              />
              <div className="flex gap-1 mt-2">
                <button onClick={() => setEditing(false)} className="px-3 py-1 text-xs text-stone-600 hover:bg-stone-100 rounded-md">취소</button>
                <button onClick={handleSaveEdit} disabled={!editDraft.trim()} className="px-3 py-1 text-xs bg-stone-900 text-white rounded-md disabled:opacity-30">저장</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDetail(!showDetail)} className="block text-left w-full">
              <div className="text-sm font-semibold text-stone-900 mb-1">{p.title}</div>
              <div className="text-xs text-stone-500 flex items-center gap-2 flex-wrap">
                <span className="font-semibold" style={{ color: userColor.text }}>
                  {userInfo?.displayName || '사용자'}
                </span>
                <span>·</span>
                <span>{currentStatus.label}</span>
                {normalizedStatus === 'done' && p.answeredAt && (
                  <>
                    <span>·</span>
                    <span>{new Date(p.answeredAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 완료</span>
                  </>
                )}
                {comments.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1"><MessageCircle size={10} /> {comments.length}</span>
                  </>
                )}
              </div>
            </button>
          )}
        </div>

        {isMine && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setEditing(true); setEditDraft(p.title); }} className="p-1.5 text-stone-400 hover:text-stone-700" title="제목 수정">
              <Edit2 size={13} />
            </button>
            <button onClick={() => { if (confirm('이 기도제목을 삭제하시겠습니까?')) onDelete(); }} className="p-1.5 text-stone-400 hover:text-red-500" title="삭제">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {showDetail && !editing && (
        <div className="border-t border-stone-100 p-4 bg-stone-50/50">
          {comments.length > 0 && (
            <div className="space-y-2 mb-3">
              {comments.map(c => {
                const cColor = getUserColor(c.byUid);
                const cInfo = getUserInfo(c.byUid);
                const cIsMine = c.byUid === currentUid;
                return (
                  <div key={c.id} className="bg-white rounded-lg p-3 flex items-start gap-2 text-xs border" style={{ borderColor: cColor.border + '40' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5" style={{ backgroundColor: cColor.border, color: 'white' }}>
                      {(cInfo?.displayName || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div>
                        <span className="font-semibold" style={{ color: cColor.text }}>{cInfo?.displayName}</span>
                        <span className="text-stone-500 ml-1.5">{new Date(c.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-stone-700 mt-1 leading-relaxed" style={{ wordBreak: 'keep-all' }}>{c.text}</div>
                    </div>
                    {cIsMine && (<button onClick={() => deleteComment(c.id)} className="text-stone-300 hover:text-red-500 shrink-0"><X size={12} /></button>)}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentDraft}
              onChange={e => setCommentDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && commentDraft.trim()) {
                  addComment(commentDraft);
                  setCommentDraft('');
                }
              }}
              placeholder="진행 과정이나 생각을 남겨보세요…"
              className="flex-1 bg-white border border-stone-200 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-stone-400"
            />
            {commentDraft.trim() && (
              <button onClick={() => { addComment(commentDraft); setCommentDraft(''); }} className="p-1.5 rounded-full bg-stone-900 text-white">
                <Send size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 가족방 설정
// ============================================================
function SettingsView({ familyData, familyId, currentUid, getUserColor, onLeaveFamily, onChangeColor }) {
  const [copied, setCopied] = useState(false);
  const me = familyData.members?.find(m => m.uid === currentUid);
  const myColorId = me?.colorId;

  const inviteUrl = `${window.location.origin}/#invite=${familyData.inviteCode}`;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('복사 실패. 아래 링크를 직접 복사해주세요:\n' + inviteUrl);
    }
  }

  return (
    <div>
      <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-4">
        <h2 className="text-lg font-bold tracking-tight mb-1">{familyData.name}</h2>
        <p className="text-sm text-stone-500 mb-5">멤버 {familyData.members?.length}명</p>

        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">멤버</h3>
        <div className="space-y-2 mb-5">
          {familyData.members?.map(m => {
            const color = getUserColor(m.uid);
            return (
              <div key={m.uid} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2" style={{ borderColor: color.border, backgroundColor: color.bg }}>
                  {m.photoURL ? (
                    <img src={m.photoURL} alt={m.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold" style={{ color: color.text }}>
                      {m.displayName?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {m.displayName} {m.uid === currentUid && <span className="text-xs text-stone-400">(나)</span>}
                  </div>
                  <div className="text-xs text-stone-500 truncate">{m.email}</div>
                </div>
                <div className="text-xs" style={{ color: color.text }}>{color.name}</div>
              </div>
            );
          })}
        </div>

        {/* 초대 */}
        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">가족 초대</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <div className="text-xs text-amber-700 mb-1">초대 코드</div>
          <div className="font-mono text-2xl font-bold tracking-widest text-amber-900 mb-3 text-center">
            {familyData.inviteCode}
          </div>
          <div className="text-xs text-stone-500 mb-3 break-all bg-white p-2 rounded-lg">
            {inviteUrl}
          </div>
          <button onClick={copyInvite} className="w-full py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2">
            {copied ? (<><Check size={14} /> 복사됨!</>) : (<><Copy size={14} /> 초대 링크 복사</>)}
          </button>
          <p className="text-xs text-stone-500 mt-2 text-center leading-relaxed">
            이 링크를 가족에게 보내주세요.<br/>
            링크를 열면 자동으로 가족방에 참가할 수 있어요.
          </p>
        </div>

        {/* 내 색상 변경 */}
        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">내 색상</h3>
        <div className="grid grid-cols-5 gap-2 mb-5">
          {COLOR_PALETTE.map(c => (
            <button
              key={c.id}
              onClick={() => onChangeColor(c.id)}
              className={`aspect-square rounded-xl border-2 transition-all flex items-center justify-center ${
                myColorId === c.id ? 'border-stone-900 scale-110 shadow-lg' : 'border-stone-200 hover:scale-105'
              }`}
              style={{ backgroundColor: c.bg }}
              title={c.name}
            >
              {myColorId === c.id && <Check size={18} strokeWidth={3} style={{ color: c.text }} />}
            </button>
          ))}
        </div>

        <button onClick={onLeaveFamily} className="w-full py-2.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1">
          <LogOut size={14} /> 가족방 나가기
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 공유 카드
// ============================================================
function ShareCardModal({ card, onClose }) {
  const [downloading, setDownloading] = useState(false);
  async function handleDownload() {
    setDownloading(true);
    try {
      const w = 800, h = 1000;
      const text = card.text;
      const verseLabel = `${card.bookName} ${card.chapter}:${card.verse}`;
      const lineLength = 16;
      const lines = [];
      let cur = '';
      for (const ch of text) {
        cur += ch;
        if (cur.length >= lineLength && (ch === ' ' || cur.length >= lineLength + 4)) { lines.push(cur.trim()); cur = ''; }
      }
      if (cur) lines.push(cur.trim());
      const lineH = 56;
      const startY = h / 2 - (lines.length * lineH) / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fafaf9"/><stop offset="100%" stop-color="#e7e5e4"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="60" y="60" width="${w-120}" height="${h-120}" fill="none" stroke="#1c1917" stroke-width="2"/>
  <text x="${w/2}" y="160" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="24" font-weight="700" fill="#78716c" letter-spacing="8">FILSA · 筆寫</text>
  ${lines.map((line, i) => `<text x="${w/2}" y="${startY + i * lineH}" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="36" font-weight="500" fill="#1c1917">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`).join('\n  ')}
  <text x="${w/2}" y="${h - 140}" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="28" font-weight="700" fill="#1c1917">${verseLabel}</text>
  <text x="${w/2}" y="${h - 100}" text-anchor="middle" font-family="Noto Sans KR, sans-serif" font-size="18" font-weight="400" fill="#a8a29e">개역개정</text>
</svg>`;
      const img = new Image();
      const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = `${card.bookName}_${card.chapter}_${card.verse}.png`;
        a.click();
        URL.revokeObjectURL(dlUrl);
      }, 'image/png');
    } catch (err) {
      alert('이미지 생성 실패: ' + err.message);
    } finally {
      setDownloading(false);
    }
  }
  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(`"${card.text}"\n\n${card.bookName} ${card.chapter}:${card.verse}`);
      alert('구절이 복사되었습니다.');
    } catch { alert('복사 실패'); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-stone-50 to-stone-200 p-8 aspect-[4/5] flex flex-col" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
          <div className="border-2 border-stone-900 flex flex-col justify-between p-6 h-full">
            <div className="text-center text-xs font-bold text-stone-500 tracking-[0.4em]">FILSA · 筆寫</div>
            <p className="text-center text-stone-900 text-lg font-medium leading-relaxed" style={{ wordBreak: 'keep-all' }}>{card.text}</p>
            <div className="text-center">
              <div className="text-base font-bold text-stone-900 tracking-tight">{card.bookName} {card.chapter}:{card.verse}</div>
              <div className="text-xs text-stone-400 mt-1">개역개정</div>
            </div>
          </div>
        </div>
        <div className="p-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-stone-600 hover:bg-stone-100 rounded-lg text-sm font-medium">닫기</button>
          <button onClick={handleCopyText} className="flex-1 py-2.5 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg text-sm font-medium">텍스트 복사</button>
          <button onClick={handleDownload} disabled={downloading} className="flex-1 py-2.5 bg-stone-900 text-white hover:bg-stone-800 rounded-lg text-sm font-medium disabled:opacity-50">{downloading ? '생성 중...' : '이미지 저장'}</button>
        </div>
      </div>
    </div>
  );
}
