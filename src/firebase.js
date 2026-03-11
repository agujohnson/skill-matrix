// src/firebase.js
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  OAuthProvider,
  signOut,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
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
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
export const register = (email, password) => createUserWithEmailAndPassword(auth, email, password)
export const loginWithMicrosoft = () => {
  const provider = new OAuthProvider('microsoft.com')
  provider.setCustomParameters({ tenant: import.meta.env.VITE_AZURE_TENANT_ID })
  return signInWithPopup(auth, provider)
}
export const logout = () => signOut(auth)
export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
export const createUserProfile = (uid, data) => setDoc(doc(db, 'users', uid), data)

// ─── People ───────────────────────────────────────────────────────────────────
export const onUsersSnapshot = (callback) =>
  onSnapshot(collection(db, 'users'), snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
export const updateUserProfile = (uid, data) => updateDoc(doc(db, 'users', uid), data)
export const deleteUserData = async (uid) => {
  // Removes all Firestore data for this user (profile, assessments, certs)
  // Note: Firebase Auth account requires Admin SDK to delete server-side
  await Promise.all([
    deleteDoc(doc(db, 'users',       uid)),
    deleteDoc(doc(db, 'assessments', uid)),
    deleteDoc(doc(db, 'userCerts',   uid)),
  ])
}

// ─── Assessments ──────────────────────────────────────────────────────────────
export const saveAssessment = (userId, skillId, data) =>
  setDoc(doc(db, 'assessments', userId), { [skillId]: data }, { merge: true })
export const saveAssessmentsBulk = (userId, assessmentsObj) =>
  setDoc(doc(db, 'assessments', userId), assessmentsObj)

export const getAssessments = async (userId) => {
  const snap = await getDoc(doc(db, 'assessments', userId))
  return snap.exists() ? snap.data() : {}
}
export const onAssessmentsSnapshot = (callback) =>
  onSnapshot(collection(db, 'assessments'), snap => {
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
  onSnapshot(collection(db, 'userCerts'), snap => {
    const data = {}
    snap.forEach(d => { data[d.id] = d.data().certs || [] })
    callback(data)
  })

// ─── Skill Categories ─────────────────────────────────────────────────────────
export const getCategories = async () => {
  const snap = await getDoc(doc(db, 'config', 'categories'))
  return snap.exists() ? snap.data().list : null
}
export const saveCategories = (list) => setDoc(doc(db, 'config', 'categories'), { list })

// ─── Certifications Library ───────────────────────────────────────────────────
export const getCertsLibrary = async () => {
  const snap = await getDoc(doc(db, 'config', 'certsLibrary'))
  return snap.exists() ? snap.data().list : null
}
export const saveCertsLibrary = (list) => setDoc(doc(db, 'config', 'certsLibrary'), { list })

// ─── Invite Code ─────────────────────────────────────────────────────────────
export const getInviteCode = async () => {
  const snap = await getDoc(doc(db, 'config', 'settings'))
  return snap.exists() ? (snap.data().inviteCode || null) : null
}
export const saveInviteCode = (code) =>
  setDoc(doc(db, 'config', 'settings'), { inviteCode: code }, { merge: true })

export const getAnthropicKey = async () => {
  const snap = await getDoc(doc(db, 'config', 'settings'))
  return snap.exists() ? (snap.data().anthropicKey || null) : null
}
export const saveAnthropicKey = (key) =>
  setDoc(doc(db, 'config', 'settings'), { anthropicKey: key }, { merge: true })

// ─── Pending Users (CV Import) ────────────────────────────────────────────────
export const savePendingUser = (data) =>
  setDoc(doc(db, 'pendingUsers', data.email.toLowerCase()), { ...data, createdAt: Date.now() })
export const getPendingUserByEmail = async (email) => {
  const snap = await getDoc(doc(db, 'pendingUsers', email.toLowerCase()))
  return snap.exists() ? snap.data() : null
}
export const deletePendingUser = (email) =>
  deleteDoc(doc(db, 'pendingUsers', email.toLowerCase()))
export const onPendingUsersSnapshot = (callback) =>
  onSnapshot(collection(db, 'pendingUsers'), snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )

// ─── Suggestions ──────────────────────────────────────────────────────────────
export const submitSuggestion = (data) =>
  addDoc(collection(db, 'suggestions'), { ...data, status: 'pending', createdAt: Date.now() })
export const onSuggestionsSnapshot = (callback) =>
  onSnapshot(collection(db, 'suggestions'), snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  )
export const approveSuggestion = (id) => updateDoc(doc(db, 'suggestions', id), { status: 'approved' })
export const rejectSuggestion  = (id) => updateDoc(doc(db, 'suggestions', id), { status: 'rejected' })
