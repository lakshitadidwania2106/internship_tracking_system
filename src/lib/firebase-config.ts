export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyBHJ3j7OlPyLNVt5oSCuHZXPDQ-5MEfrCo",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "internship-tracking-syst-593e4.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "internship-tracking-syst-593e4",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "internship-tracking-syst-593e4.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "757077593043",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:757077593043:web:9b6820f83cf0995922fd26",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-ZP7P4GLXXD",
};
