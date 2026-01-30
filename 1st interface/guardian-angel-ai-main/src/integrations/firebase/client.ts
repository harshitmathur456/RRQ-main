import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "adamya-c0ab1.firebaseapp.com",
    projectId: "adamya-c0ab1",
    storageBucket: "adamya-c0ab1.firebasestorage.app",
    messagingSenderId: "573320828318",
    appId: "1:573320828318:web:36f0f9864316b05b4c328f",
    measurementId: "G-L5ZCC39PFG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const messaging = getMessaging(app);

// Helper to request permission
export const requestForToken = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const currentToken = await getToken(messaging, {
                // vapidKey: 'YOUR_VAPID_KEY_HERE' // Placeholder removed to prevent InvalidAccessError
            });
            if (currentToken) {
                console.log('FCM Token:', currentToken);
                return currentToken;
            } else {
                console.log('No registration token available. Request permission to generate one.');
                return null;
            }
        } else {
            console.log('Notification permission not granted.');
            return null;
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
        return null;
    }
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        onMessage(messaging, (payload) => {
            resolve(payload);
        });
    });
