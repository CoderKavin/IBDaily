import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAt_al4Ch8UDhl6bPTJREOJExdsl8K7Fd4",
  authDomain: "locker-1c87b.firebaseapp.com",
  projectId: "locker-1c87b",
  storageBucket: "locker-1c87b.firebasestorage.app",
  messagingSenderId: "230771964681",
  appId: "1:230771964681:web:90ad0006cf2d59c911f1d8",
};

// Initialize Firebase only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { auth, firebaseSignOut as signOut };
export type { User };

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
