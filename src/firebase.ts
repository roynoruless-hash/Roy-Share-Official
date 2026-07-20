import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAk_RxpByFDuU44wFJI1wrDQQqorVJVLAI",
  authDomain: "roy-share-official.firebaseapp.com",
  projectId: "roy-share-official",
  storageBucket: "roy-share-official.firebasestorage.app",
  messagingSenderId: "66517917793",
  appId: "1:66517917793:web:1a7cf1d933dddf06584a20",
  measurementId: "G-QEJ25FGV4L"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
