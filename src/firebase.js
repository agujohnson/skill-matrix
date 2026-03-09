// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// Firebase initialisation + Firestore helpers used throughout the app.
// All env vars come from .env.local (see .env.example).
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app  = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const login  = (email, password) => signInWithEmailAndPassword(auth, email, password)
export const logout = () => signOut(auth)

/** Returns user profile doc from Firestore (role, name, team …) */
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ─── Assessments ──────────────────────────────────────────────────────────────

/** Save a single skill assessment for a user */
export const saveAssessment = (userId, skillId, data) =>
  setDoc(doc(db, 'assessments', userId), { [skillId]: data }, { merge: true })

/** Get all assessments for one user */
export const getAssessments = async (userId) => {
  const snap = await getDoc(doc(db, 'assessments', userId))
  return snap.exists() ? snap.data() : {}
}

/** Real-time listener for all assessments (manager view) */
export const onAssessmentsSnapshot = (callback) =>
  onSnapshot(collection(db, 'assessments'), (snap) => {
    const data = {}
    snap.forEach(d => { data[d.id] = d.data() })
    callback(data)
  })

// ─── User Certifications ──────────────────────────────────────────────────────

export const saveUserCerts = (userId, certs) =>
  setDoc(doc(db, 'userCerts', userId), { certs }, { merge: false })

export const getUserCerts = async (userId) => {
  const snap = await getDoc(doc(db, 'userCerts', userId))
  return snap.exists() ? (snap.data().certs || []) : []
}

export const onUserCertsSnapshot = (callback) =>
  onSnapshot(collection(db, 'userCerts'), (snap) => {
    const data = {}
    snap.forEach(d => { data[d.id] = d.data().certs || [] })
    callback(data)
  })

// ─── Skill Categories ─────────────────────────────────────────────────────────

export const getCategories = async () => {
  const snap = await getDoc(doc(db, 'config', 'categories'))
  return snap.exists() ? snap.data().list : null
}

export const saveCategories = (list) =>
  setDoc(doc(db, 'config', 'categories'), { list })

// ─── Certifications Library ───────────────────────────────────────────────────

export const getCertsLibrary = async () => {
  const snap = await getDoc(doc(db, 'config', 'certsLibrary'))
  return snap.exists() ? snap.data().list : null
}

export const saveCertsLibrary = (list) =>
  setDoc(doc(db, 'config', 'certsLibrary'), { list })
