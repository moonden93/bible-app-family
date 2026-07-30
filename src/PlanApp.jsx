import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  doc, onSnapshot, setDoc, updateDoc, getDoc,
  arrayUnion, serverTimestamp
} from 'firebase/firestore';
import { LogOut, Copy, Plus, UserPlus, Check, ChevronLeft, Users, BookOpen } from 'lucide-react';

// ============================================================
// 성경 66권 · 장 수
// ============================================================
const BOOKS = [
  ['창세기', 50], ['출애굽기', 40], ['레위기', 27], ['민수기', 36], ['신명기', 34],
  ['여호수아', 24], ['사사기', 21], ['룻기', 4], ['사무엘상', 31], ['사무엘하', 24],
  ['열왕기상', 22], ['열왕기하', 25], ['역대상', 29], ['역대하', 36], ['에스라', 10],
  ['느헤미야', 13], ['에스더', 10], ['욥기', 42], ['시편', 150], ['잠언', 31],
  ['전도서', 12], ['아가', 8], ['이사야', 66], ['예레미야', 52], ['예레미야애가', 5],
  ['에스겔', 48], ['다니엘', 12], ['호세아', 14], ['요엘', 3], ['아모스', 9],
  ['오바댜', 1], ['요나', 4], ['미가', 7], ['나훔', 3], ['하박국', 3],
  ['스바냐', 3], ['학개', 2], ['스가랴', 14], ['말라기', 4],
  ['마태복음', 28], ['마가복음', 16], ['누가복음', 24], ['요한복음', 21], ['사도행전', 28],
  ['로마서', 16], ['고린도전서', 16], ['고린도후서', 13], ['갈라디아서', 6], ['에베소서', 6],
  ['빌립보서', 4], ['골로새서', 4], ['데살로니가전서', 5], ['데살로니가후서', 3], ['디모데전서', 6],
  ['디모데후서', 4], ['디도서', 3], ['빌레몬서', 1], ['히브리서', 13], ['야고보서', 5],
  ['베드로전서', 5], ['베드로후서', 3], ['요한1서', 5], ['요한2서', 1], ['요한3서', 1],
  ['유다서', 1], ['요한계시록', 22]
];

const ALL_CHAPTERS = [];
BOOKS.forEach(([book, count]) => {
  for (let ch = 1; ch <= count; ch++) ALL_CHAPTERS.push({ book, ch });
});
const TOTAL_CHAPTERS = ALL_CHAPTERS.length; // 1189

// ============================================================
// 색상 팔레트
// ============================================================
const COLORS = [
  { id: 'rose',    bg: '#fda4af', border: '#e11d48', text: '#881337', light: '#fff1f2', name: '로즈' },
  { id: 'coral',   bg: '#fdba74', border: '#ea580c', text: '#7c2d12', light: '#fff7ed', name: '코랄' },
  { id: 'amber',   bg: '#fcd34d', border: '#d97706', text: '#78350f', light: '#fffbeb', name: '앰버' },
  { id: 'emerald', bg: '#6ee7b7', border: '#059669', text: '#064e3b', light: '#ecfdf5', name: '에메랄드' },
  { id: 'teal',    bg: '#5eead4', border: '#0d9488', text: '#134e4a', light: '#f0fdfa', name: '틸' },
  { id: 'sky',     bg: '#7dd3fc', border: '#0284c7', text: '#0c4a6e', light: '#f0f9ff', name: '하늘색' },
  { id: 'indigo',  bg: '#a5b4fc', border: '#4f46e5', text: '#312e81', light: '#eef2ff', name: '인디고' },
  { id: 'violet',  bg: '#c4b5fd', border: '#7c3aed', text: '#4c1d95', light: '#f5f3ff', name: '바이올렛' },
  { id: 'pink',    bg: '#f9a8d4', border: '#db2777', text: '#831843', light: '#fdf2f8', name: '핑크' },
  { id: 'stone',   bg: '#d6d3d1', border: '#57534e', text: '#1c1917', light: '#fafaf9', name: '스톤' },
];

const DEFAULT_START = '2026-07-26';
const DEFAULT_CHAPTERS_PER_DAY = 10;

// ============================================================
// 유틸
// ============================================================
function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
const WEEKDAYS = ['일','월','화','수','목','금','토'];
function parseDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtYMD(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function dayDate(startYMD, dayIdx) {
  const dt = parseDate(startYMD);
  dt.setDate(dt.getDate() + dayIdx);
  return dt;
}
function fmtDate(dt) {
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${WEEKDAYS[dt.getDay()]})`;
}
function totalDays(chaptersPerDay) {
  return Math.ceil(TOTAL_CHAPTERS / chaptersPerDay);
}
function dayBlocks(dayIdx, chaptersPerDay) {
  const start = dayIdx * chaptersPerDay;
  const end = Math.min(start + chaptersPerDay, TOTAL_CHAPTERS);
  const blocks = [];
  let cur = null;
  for (let i = start; i < end; i++) {
    const c = ALL_CHAPTERS[i];
    if (!cur || cur.book !== c.book) {
      cur = { book: c.book, chapters: [] };
      blocks.push(cur);
    }
    cur.chapters.push({ i, ch: c.ch });
  }
  return blocks;
}
function colorOf(colorId) {
  return COLORS.find(c => c.id === colorId) || COLORS[9];
}

// ============================================================
// 최상위 컴포넌트
// ============================================================
export default function PlanApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [myRoomCodes, setMyRoomCodes] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [currentRoom, setCurrentRoom] = useState(null); // roomCode

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setMyRoomCodes([]);
      setRoomsLoading(false);
      return;
    }
    setRoomsLoading(true);
    const ref = doc(db, 'userReadingRooms', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      setMyRoomCodes(data?.roomCodes || []);
      setRoomsLoading(false);
    }, () => setRoomsLoading(false));
    return () => unsub();
  }, [user]);

  if (authLoading) return <Loading text="로딩 중..." />;
  if (!user) return <SignInScreen />;
  if (currentRoom) return <RoomView user={user} roomCode={currentRoom} onExit={() => setCurrentRoom(null)} />;
  return <RoomListScreen user={user} roomCodes={myRoomCodes} loading={roomsLoading} onOpen={(c) => setCurrentRoom(c)} />;
}

// ============================================================
// 공통 요소
// ============================================================
function Loading({ text }) {
  return (
    <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="text-center">
        <div className="inline-block w-9 h-9 border-4 border-stone-300 border-t-stone-900 rounded-full animate-spin mb-3"></div>
        <p className="text-stone-500 text-sm">{text}</p>
      </div>
    </div>
  );
}

// ============================================================
// 로그인 화면
// ============================================================
function SignInScreen() {
  const [err, setErr] = useState('');
  async function handleSignIn() {
    setErr('');
    try { await signInWithPopup(auth, googleProvider); }
    catch (e) { setErr(e.message); }
  }
  return (
    <div className="min-h-screen w-full bg-stone-50 flex items-center justify-center p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">📖</div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">함께 통독</h1>
          <p className="text-sm text-stone-500">친구와 성경을 매일 조금씩</p>
        </div>
        <button onClick={handleSignIn} className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-colors">
          Google 계정으로 시작
        </button>
        {err && <p className="mt-4 text-sm text-red-600 text-center">{err}</p>}
        <p className="mt-8 text-xs text-stone-400 text-center leading-relaxed">
          로그인하면 방을 만들거나 친구가 만든 방에<br />코드로 참가할 수 있어요.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// 방 목록 / 만들기 / 참가
// ============================================================
function RoomListScreen({ user, roomCodes, loading, onOpen }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [rooms, setRooms] = useState({}); // { code: roomData }
  const [roomsFetching, setRoomsFetching] = useState(false);

  useEffect(() => {
    if (roomCodes.length === 0) { setRooms({}); return; }
    setRoomsFetching(true);
    const unsubs = roomCodes.map(code => {
      return onSnapshot(doc(db, 'readingRooms', code), (snap) => {
        setRooms(prev => ({ ...prev, [code]: snap.exists() ? { id: snap.id, ...snap.data() } : null }));
        setRoomsFetching(false);
      });
    });
    return () => unsubs.forEach(u => u());
  }, [roomCodes]);

  async function handleLogout() {
    try { await signOut(auth); } catch (e) { console.error(e); }
  }

  if (mode === 'create') return <CreateRoomScreen user={user} onCancel={() => setMode(null)} onCreated={(code) => { setMode(null); onOpen(code); }} />;
  if (mode === 'join') return <JoinRoomScreen user={user} onCancel={() => setMode(null)} onJoined={(code) => { setMode(null); onOpen(code); }} />;

  return (
    <div className="min-h-screen w-full bg-stone-50 p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8 pt-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight">내 통독방</h1>
            <p className="text-xs text-stone-500 mt-0.5">{user.displayName || user.email}</p>
          </div>
          <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-stone-900 rounded-lg" title="로그아웃">
            <LogOut size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-2 mb-8">
          {loading || roomsFetching ? (
            <div className="bg-white border border-stone-200 rounded-xl p-6 text-center text-sm text-stone-400">불러오는 중…</div>
          ) : roomCodes.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
              <div className="text-3xl mb-2">📖</div>
              <p className="text-sm text-stone-500">참가한 방이 없어요.</p>
              <p className="text-xs text-stone-400 mt-1">아래에서 방을 만들거나 코드로 참가해보세요.</p>
            </div>
          ) : (
            roomCodes.map(code => {
              const room = rooms[code];
              if (!room) return null;
              const memberCount = room.members?.length || 0;
              const myReads = room.reads?.[user.uid] || [];
              const pct = Math.round((myReads.length / TOTAL_CHAPTERS) * 100);
              return (
                <button key={code} onClick={() => onOpen(code)} className="w-full bg-white border border-stone-200 hover:border-stone-400 rounded-xl p-4 text-left transition-colors">
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{room.name}</div>
                      <div className="text-xs text-stone-400 mt-0.5">코드 {code} · {memberCount}명</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums leading-none">{pct}<span className="text-sm text-stone-400">%</span></div>
                      <div className="text-[10px] text-stone-400 mt-1">내 진도</div>
                    </div>
                  </div>
                  <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-stone-900 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode('create')} className="flex items-center justify-center gap-2 py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800">
            <Plus size={16} strokeWidth={2.5} /> 방 만들기
          </button>
          <button onClick={() => setMode('join')} className="flex items-center justify-center gap-2 py-3.5 bg-white border border-stone-300 text-stone-900 rounded-xl font-medium hover:bg-stone-50">
            <UserPlus size={16} strokeWidth={2} /> 코드로 참가
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 방 만들기
// ============================================================
function CreateRoomScreen({ user, onCancel, onCreated }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(DEFAULT_START);
  const [chaptersPerDay, setChaptersPerDay] = useState(DEFAULT_CHAPTERS_PER_DAY);
  const [selectedColor, setSelectedColor] = useState(COLORS[3]); // 에메랄드 기본
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const days = totalDays(chaptersPerDay);
  const endDate = dayDate(startDate, days - 1);

  async function handleCreate() {
    if (!name.trim()) { setErr('방 이름을 입력해주세요.'); return; }
    setLoading(true);
    setErr('');
    try {
      // 코드 충돌 방지 (최대 5회 시도)
      let code;
      for (let i = 0; i < 5; i++) {
        code = genRoomCode();
        const snap = await getDoc(doc(db, 'readingRooms', code));
        if (!snap.exists()) break;
        code = null;
      }
      if (!code) throw new Error('코드 생성 실패, 다시 시도해주세요.');

      const member = {
        uid: user.uid,
        displayName: user.displayName || '사용자',
        email: user.email || '',
        photoURL: user.photoURL || null,
        colorId: selectedColor.id,
        joinedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'readingRooms', code), {
        name: name.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        config: { chaptersPerDay, startDate },
        members: [member],
        memberUids: [user.uid],
        reads: {},
      });
      await setDoc(doc(db, 'userReadingRooms', user.uid), {
        roomCodes: arrayUnion(code),
      }, { merge: true });
      onCreated(code);
    } catch (e) {
      console.error(e);
      setErr('방 만들기 실패: ' + e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-stone-50 p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="max-w-md mx-auto">
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-6"><ChevronLeft size={16} /> 뒤로</button>
        <h1 className="text-xl font-bold tracking-tight mb-6">새 통독방 만들기</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">방 이름</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 친구와 성경 통독" className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" maxLength={30} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">하루 분량</label>
              <div className="flex items-center bg-white border border-stone-200 rounded-xl overflow-hidden">
                <button onClick={() => setChaptersPerDay(Math.max(1, chaptersPerDay - 1))} className="px-3 py-3 text-stone-500 hover:bg-stone-50">-</button>
                <div className="flex-1 text-center font-bold tabular-nums">{chaptersPerDay}<span className="text-xs font-normal text-stone-400 ml-1">장</span></div>
                <button onClick={() => setChaptersPerDay(Math.min(30, chaptersPerDay + 1))} className="px-3 py-3 text-stone-500 hover:bg-stone-50">+</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1.5">시작일</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" />
            </div>
          </div>

          <div className="bg-stone-100 rounded-xl px-4 py-3 text-xs text-stone-600 leading-relaxed">
            총 <span className="font-bold tabular-nums">{days}</span>일 · 완주 예정 <span className="font-bold tabular-nums">{fmtYMD(endDate)}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-2">내 색상</label>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map(c => (
                <button key={c.id} onClick={() => setSelectedColor(c)} className={`aspect-square rounded-xl border-2 transition-all ${selectedColor.id === c.id ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`} style={{ backgroundColor: c.bg, borderColor: c.border }} title={c.name} />
              ))}
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button onClick={handleCreate} disabled={loading || !name.trim()} className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed">
            {loading ? '만드는 중...' : '만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 방 참가
// ============================================================
function JoinRoomScreen({ user, onCancel, onJoined }) {
  const [code, setCode] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[5]); // 하늘색 기본
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(null);

  async function fetchPreview(c) {
    if (c.length !== 6) { setPreview(null); return; }
    try {
      const snap = await getDoc(doc(db, 'readingRooms', c));
      if (snap.exists()) setPreview({ id: snap.id, ...snap.data() });
      else setPreview(null);
    } catch (e) { setPreview(null); }
  }

  async function handleJoin() {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) { setErr('6자리 코드를 정확히 입력해주세요.'); return; }
    setLoading(true);
    setErr('');
    try {
      const ref = doc(db, 'readingRooms', c);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setErr('방을 찾을 수 없습니다.'); setLoading(false); return; }
      const data = snap.data();
      const already = data.members?.some(m => m.uid === user.uid);
      if (!already) {
        const member = {
          uid: user.uid,
          displayName: user.displayName || '사용자',
          email: user.email || '',
          photoURL: user.photoURL || null,
          colorId: selectedColor.id,
          joinedAt: new Date().toISOString(),
        };
        await updateDoc(ref, {
          members: arrayUnion(member),
          memberUids: arrayUnion(user.uid),
        });
      }
      await setDoc(doc(db, 'userReadingRooms', user.uid), {
        roomCodes: arrayUnion(c),
      }, { merge: true });
      onJoined(c);
    } catch (e) {
      console.error(e);
      setErr('참가 실패: ' + e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-stone-50 p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="max-w-md mx-auto">
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 mb-6"><ChevronLeft size={16} /> 뒤로</button>
        <h1 className="text-xl font-bold tracking-tight mb-6">코드로 참가</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">방 코드 (6자리)</label>
            <input
              value={code}
              onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); setCode(v); fetchPreview(v); }}
              placeholder="예: AB3D9K"
              className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-lg font-mono tracking-widest text-center focus:outline-none focus:border-stone-400 uppercase"
              maxLength={6}
            />
          </div>

          {preview && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="font-bold text-sm mb-1">{preview.name}</div>
              <div className="text-xs text-stone-500">멤버 {preview.members?.length || 0}명 · 하루 {preview.config?.chaptersPerDay || 10}장</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-2">내 색상</label>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map(c => (
                <button key={c.id} onClick={() => setSelectedColor(c)} className={`aspect-square rounded-xl border-2 transition-all ${selectedColor.id === c.id ? 'ring-2 ring-stone-900 ring-offset-2' : ''}`} style={{ backgroundColor: c.bg, borderColor: c.border }} title={c.name} />
              ))}
            </div>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button onClick={handleJoin} disabled={loading || code.length !== 6} className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed">
            {loading ? '참가 중...' : '참가하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 방 화면 (체크리스트)
// ============================================================
function RoomView({ user, roomCode, onExit }) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  const pendingReadsRef = useRef(null);
  const saveTimerRef = useRef(null);

  const roomRef = useMemo(() => doc(db, 'readingRooms', roomCode), [roomCode]);

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) setRoom({ id: snap.id, ...snap.data() });
      else setRoom(null);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [roomRef]);

  if (loading) return <Loading text="방 불러오는 중..." />;
  if (!room) return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <p className="text-stone-500 mb-4">방을 찾을 수 없습니다.</p>
      <button onClick={onExit} className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm">돌아가기</button>
    </div>
  );

  const config = room.config || { chaptersPerDay: DEFAULT_CHAPTERS_PER_DAY, startDate: DEFAULT_START };
  const perDay = config.chaptersPerDay;
  const startYMD = config.startDate;
  const days = totalDays(perDay);
  const myReads = new Set((pendingReadsRef.current ?? room.reads?.[user.uid]) || []);
  const membersReads = room.reads || {};
  const members = room.members || [];
  const myMember = members.find(m => m.uid === user.uid);
  const myColor = colorOf(myMember?.colorId);

  // 진행률
  const myPct = (myReads.size / TOTAL_CHAPTERS) * 100;

  // 지금 읽을 Day (내 진도 기준)
  function currentDayIdx() {
    for (let d = 0; d < days; d++) {
      const start = d * perDay;
      const end = Math.min(start + perDay, TOTAL_CHAPTERS);
      let allDone = true;
      for (let i = start; i < end; i++) if (!myReads.has(i)) { allDone = false; break; }
      if (!allDone) return d;
    }
    return days;
  }
  const curD = currentDayIdx();

  async function toggleChapter(idx) {
    const next = new Set(pendingReadsRef.current ?? room.reads?.[user.uid] ?? []);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    pendingReadsRef.current = [...next].sort((a, b) => a - b);
    setRoom(r => ({ ...r, reads: { ...r.reads, [user.uid]: pendingReadsRef.current } }));

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateDoc(roomRef, {
          [`reads.${user.uid}`]: pendingReadsRef.current,
        });
        pendingReadsRef.current = null;
      } catch (e) {
        console.error('저장 실패:', e);
        alert('저장 실패: ' + e.message);
      }
    }, 300);
  }

  async function handleLeaveRoom() {
    if (!confirm('이 방에서 나가시겠습니까?\n내 진도는 방에 남아있습니다.')) return;
    try {
      await setDoc(doc(db, 'userReadingRooms', user.uid), {
        roomCodes: (await getDoc(doc(db, 'userReadingRooms', user.uid))).data()?.roomCodes?.filter(c => c !== roomCode) || [],
      }, { merge: true });
      onExit();
    } catch (e) { alert('실패: ' + e.message); }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1500);
    } catch (e) { alert('복사 실패'); }
  }

  const endDate = dayDate(startYMD, days - 1);

  return (
    <div className="min-h-screen w-full bg-stone-50 pb-16" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <header className="sticky top-0 z-30 bg-stone-50/95 backdrop-blur-md border-b border-stone-200">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <button onClick={onExit} className="p-2 -ml-2 hover:bg-stone-100 rounded-lg text-stone-700"><ChevronLeft size={20} strokeWidth={1.75} /></button>
            <div className="flex-1 min-w-0 text-center">
              <div className="font-bold text-sm tracking-tight truncate">{room.name}</div>
              <div className="text-[10px] text-stone-400 tabular-nums">코드 {roomCode}</div>
            </div>
            <button onClick={() => setShowMembers(true)} className="p-2 -mr-2 hover:bg-stone-100 rounded-lg text-stone-700 relative">
              <Users size={18} strokeWidth={1.75} />
              <span className="absolute -top-0.5 -right-0.5 bg-stone-900 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center tabular-nums">{members.length}</span>
            </button>
          </div>
        </header>

        <main className="px-4 sm:px-6 py-5">
          {/* 진행률 카드 */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-5">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <div className="text-xs text-stone-500 mb-0.5">내 진도</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums" style={{ color: myColor.border }}>{myReads.size}</span>
                  <span className="text-sm text-stone-400 tabular-nums">/ {TOTAL_CHAPTERS}장</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-stone-500 mb-0.5">퍼센트</div>
                <div className="text-2xl font-bold tabular-nums text-stone-700">{myPct < 1 && myPct > 0 ? myPct.toFixed(1) : Math.round(myPct)}<span className="text-sm">%</span></div>
              </div>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full transition-all rounded-full" style={{ width: `${myPct}%`, backgroundColor: myColor.border }} />
            </div>
            <div className="mt-3 flex justify-between text-[11px] text-stone-400 tabular-nums">
              <span>시작 {startYMD}</span>
              <span>완주 예정 {fmtYMD(endDate)}</span>
            </div>
          </div>

          {/* 멤버 진도 요약 */}
          {members.length > 1 && (
            <div className="bg-white border border-stone-200 rounded-2xl p-4 mb-5">
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">멤버 진도</div>
              <div className="space-y-2.5">
                {members.map(m => {
                  const c = colorOf(m.colorId);
                  const r = new Set(membersReads[m.uid] || (m.uid === user.uid ? [...myReads] : []));
                  const pct = (r.size / TOTAL_CHAPTERS) * 100;
                  return (
                    <div key={m.uid} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.border }} />
                      <div className="flex-1 min-w-0 text-xs font-medium truncate">{m.displayName}{m.uid === user.uid && ' (나)'}</div>
                      <div className="text-xs text-stone-400 tabular-nums shrink-0">{r.size}장</div>
                      <div className="w-16 h-1 bg-stone-100 rounded-full overflow-hidden shrink-0">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: c.border }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 지금 읽을 Day */}
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 px-1">지금 읽을 일정</div>
          {curD >= days ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center mb-6">
              <div className="text-3xl mb-1">🎉</div>
              <div className="text-lg font-bold text-emerald-700 mb-0.5">완주 축하합니다!</div>
              <div className="text-xs text-emerald-600">{days}일 · 창세기부터 요한계시록까지</div>
            </div>
          ) : (
            <DayCard
              dayIdx={curD}
              perDay={perDay}
              startYMD={startYMD}
              myReads={myReads}
              membersReads={membersReads}
              members={members}
              currentUid={user.uid}
              onToggle={toggleChapter}
              isCurrent={true}
            />
          )}

          {/* 전체 일정 */}
          <div className="flex items-baseline justify-between text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2 mt-6 px-1">
            <span>전체 일정</span>
            <span className="normal-case tracking-normal tabular-nums text-stone-400">{days}일</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: days }, (_, d) => (
              <DayCard
                key={d}
                dayIdx={d}
                perDay={perDay}
                startYMD={startYMD}
                myReads={myReads}
                membersReads={membersReads}
                members={members}
                currentUid={user.uid}
                onToggle={toggleChapter}
                isCurrent={d === curD}
              />
            ))}
          </div>

          <div className="mt-8 pt-5 border-t border-stone-200 flex items-center justify-between text-xs text-stone-400">
            <button onClick={copyCode} className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-stone-100 rounded-md">
              <Copy size={12} strokeWidth={2} /> {copyOk ? '복사됨' : `코드 ${roomCode} 복사`}
            </button>
            <button onClick={handleLeaveRoom} className="px-2.5 py-1.5 hover:bg-stone-100 rounded-md">방 나가기</button>
          </div>
        </main>
      </div>

      {/* 멤버 시트 */}
      {showMembers && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 flex items-end sm:items-center justify-center p-4" onClick={() => setShowMembers(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm">방 멤버 ({members.length})</h3>
              <button onClick={() => setShowMembers(false)} className="text-stone-400 hover:text-stone-900 text-xs">닫기</button>
            </div>
            <div className="space-y-2 mb-4">
              {members.map(m => {
                const c = colorOf(m.colorId);
                return (
                  <div key={m.uid} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: c.border }}>
                      {(m.displayName || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.displayName}{m.uid === user.uid && ' (나)'}</div>
                      <div className="text-xs text-stone-400 truncate">{m.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-stone-50 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider">방 초대 코드</div>
                <div className="font-mono font-bold text-lg tracking-widest tabular-nums">{roomCode}</div>
              </div>
              <button onClick={copyCode} className="shrink-0 px-3 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium">{copyOk ? '복사됨' : '복사'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Day 카드
// ============================================================
function DayCard({ dayIdx, perDay, startYMD, myReads, membersReads, members, currentUid, onToggle, isCurrent }) {
  const blocks = dayBlocks(dayIdx, perDay);
  const start = dayIdx * perDay;
  const end = Math.min(start + perDay, TOTAL_CHAPTERS);
  const totalInDay = end - start;
  let myCount = 0;
  for (let i = start; i < end; i++) if (myReads.has(i)) myCount++;
  const allDone = myCount === totalInDay;
  const date = dayDate(startYMD, dayIdx);
  const myMember = members.find(m => m.uid === currentUid);
  const myColor = colorOf(myMember?.colorId);

  const cardCls = ['bg-white', 'border', 'rounded-xl', 'p-3.5', 'transition-all'];
  if (isCurrent) {
    cardCls.push('border-stone-900', 'ring-2', 'ring-stone-900/10', 'p-4');
  } else if (allDone) {
    cardCls.push('border-stone-200', 'opacity-60');
  } else {
    cardCls.push('border-stone-200');
  }

  return (
    <article className={cardCls.join(' ')}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isCurrent && <span className="text-[9px] font-bold uppercase tracking-widest bg-stone-900 text-white px-1.5 py-0.5 rounded">지금 읽기</span>}
          <span className="text-sm font-bold tabular-nums">Day {dayIdx + 1}</span>
          <span className="text-xs text-stone-400">{fmtDate(date)}</span>
        </div>
        <span className={`text-xs font-bold tabular-nums shrink-0 ${allDone ? 'text-emerald-600' : 'text-stone-400'}`}>
          {allDone ? '✓ 완료' : `${myCount}/${totalInDay}`}
        </span>
      </div>
      <div className="space-y-2">
        {blocks.map((b, bi) => (
          <div key={bi} className="flex items-center gap-2 flex-wrap">
            <div className="text-xs font-semibold text-stone-600 min-w-[52px]">{b.book}</div>
            <div className="flex flex-wrap gap-1.5">
              {b.chapters.map(c => {
                const isMine = myReads.has(c.i);
                // 다른 멤버 중 읽은 사람들의 색상
                const otherReaders = members
                  .filter(m => m.uid !== currentUid && (membersReads[m.uid] || []).includes(c.i))
                  .map(m => colorOf(m.colorId));
                return (
                  <div key={c.i} className="relative">
                    <button
                      onClick={() => onToggle(c.i)}
                      aria-pressed={isMine}
                      aria-label={`${b.book} ${c.ch}장`}
                      className={`w-8 h-8 rounded-full border font-bold text-xs tabular-nums transition-all flex items-center justify-center ${isMine ? 'text-white border-transparent' : 'bg-white border-stone-300 text-stone-500 hover:border-stone-500 hover:text-stone-800'}`}
                      style={isMine ? { backgroundColor: myColor.border } : undefined}
                    >
                      {c.ch}
                    </button>
                    {otherReaders.length > 0 && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-[2px]">
                        {otherReaders.slice(0, 3).map((r, ri) => (
                          <span key={ri} className="w-1.5 h-1.5 rounded-full ring-1 ring-white" style={{ backgroundColor: r.border }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
