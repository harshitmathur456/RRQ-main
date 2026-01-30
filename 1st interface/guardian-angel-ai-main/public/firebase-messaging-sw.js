// Give the service worker access to Firebase Messaging.
// Note: You need to import the scripts from CDN because we can't use modules in SW easily without bundler config
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
    apiKey: "AIzaSyBhz6vV6SCnm7uWgKEO6slhYmIGJ7ei8aA",
    authDomain: "adamya-c0ab1.firebaseapp.com",
    projectId: "adamya-c0ab1",
    storageBucket: "adamya-c0ab1.firebasestorage.app",
    messagingSenderId: "573320828318",
    appId: "1:573320828318:web:36f0f9864316b05b4c328f",
    measurementId: "G-L5ZCC39PFG"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
