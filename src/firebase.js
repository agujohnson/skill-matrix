// src/firebase.js
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
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

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const register = async (email, password) =>
  createUserWithEmailAndPassword(auth, email, password)

export const loginWithMicrosoft = () => {
  const provider = new OAuthProvider('microsoft.com')
  provider.setCustomParameters({ tenant: import.meta.env.VITE_AZURE_TENANT_ID })
  return signInWithPopup(auth, provider)
}

export const logout = () => signOut(auth)

/** Returns user profile doc from Firestore — null if not yet created */
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** Create a user profile (called on first Microsoft login) */
export const createUserProfile = (uid, data) =>
  setDoc(doc(db, 'users', uid), data)

// ─── Assessments ──────────────────────────────────────────────────────────────

export const saveAssessment = (userId, skillId, data) =>
  setDoc(doc(db, 'assessments', userId), { [skillId]: data }, { merge: true })

export const getAssessments = async (userId) => {
  const snap = await getDoc(doc(db, 'assessments', userId))
  return snap.exists() ? snap.data() : {}
}

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
