import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCauuJgxgVw35fP1UFwGrtieTYi8WSnE2E",
  authDomain: "aizzay.firebaseapp.com",
  projectId: "aizzay",
  storageBucket: "aizzay.firebasestorage.app",
  messagingSenderId: "678616818805",
  appId: "1:678616818805:web:b49fc5d1cacb3dda81c43c"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export { db };
