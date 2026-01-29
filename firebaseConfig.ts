import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
    apiKey: "AIzaSyDtwWFellqdedkW3W960cIJ-SfCUHnMEYs",
    authDomain: "wos-commander.firebaseapp.com",
    projectId: "wos-commander",
    storageBucket: "wos-commander.firebasestorage.app",
    messagingSenderId: "876220251158",
    appId: "1:876220251158:web:52a24c395a86253e014937",
    measurementId: "G-L4DL1XH8CV"


};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
