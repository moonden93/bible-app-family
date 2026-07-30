// Firebase 초기화 및 연결 설정
import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC9IB7B9frc7lNH3OZhWSANt9YARSGowTo",
  authDomain: "filsa-bible.web.app",
  projectId: "filsa-bible",
  storageBucket: "filsa-bible.firebasestorage.app",
  messagingSenderId: "154299855402",
  appId: "1:154299855402:web:753cc5c6fa34d551e24953"
};

const app = initializeApp(firebaseConfig);

// sessionStorage 파티셔닝 이슈 회피를 위해 IndexedDB 우선 사용
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
