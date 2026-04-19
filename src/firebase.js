// Firebase 초기화 및 연결 설정
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC9IB7B9frc7lNH3OZhWSANt9YARSGowTo",
  authDomain: "filsa-bible.firebaseapp.com",
  projectId: "filsa-bible",
  storageBucket: "filsa-bible.firebasestorage.app",
  messagingSenderId: "154299855402",
  appId: "1:154299855402:web:753cc5c6fa34d551e24953"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
