# Reailize Skill Matrix

A web app for engineering practice teams to document and track skills, proficiency levels, and certifications — with a manager dashboard for heatmaps and gap analysis.

---

## Stack

- **React + Vite** — frontend
- **Firebase Auth** — email/password authentication
- **Firestore** — real-time data persistence
- **Vercel** — hosting & deployment

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_ORG/reailize-skill-matrix.git
cd reailize-skill-matrix
npm install
```

### 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `reailize-skill-matrix`
3. Once created, go to **Project Settings → Your Apps → Add App → Web**
4. Register the app and copy the `firebaseConfig` values

### 3. Enable Firebase services

In the Firebase console:

- **Authentication** → Sign-in method → Enable **Email/Password**
- **Firestore Database** → Create database → Start in **test mode** (you can tighten rules later)

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your Firebase project values:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 5. Create user accounts in Firebase

Each team member needs an account. For now, create them manually in the Firebase console:

1. **Authentication → Users → Add user** — add email + password for each person
2. After creating a user, copy their **UID**
3. In **Firestore → users collection**, create a document with that UID as the document ID, and these fields:

```json
{
  "name": "Agustin Johnson",
  "email": "agustin@reailize.com",
  "role": "manager",
  "team": "Practice"
}
```

> `role` must be either `"manager"` or `"member"`.

### 6. Run locally

```bash
npm run dev
```

App will be available at `http://localhost:5173`

---

## Deploy to Vercel

### Option A — Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. When asked for environment variables, add all `VITE_FIREBASE_*` values.

### Option B — Vercel Dashboard

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Set **Framework Preset** to `Vite`
4. Under **Environment Variables**, add all values from `.env.local`
5. Click **Deploy**

---

## Firestore Data Structure

```
/users/{uid}
  name: string
  email: string
  role: "manager" | "member"
  team: string

/assessments/{uid}
  {skillId}: { prof: 0-4, interest: "Low"|"Medium"|"High" }

/userCerts/{uid}
  certs: [{ certId, status: "Earned"|"Planned", date }]

/config/categories
  list: [ { id, name, color, skills: [{ id, name }] } ]

/config/certsLibrary
  list: [ { id, name, provider, level } ]
```

---

## Proficiency Scale

| Level | Label     | Meaning |
|-------|-----------|---------|
| 0     | N/A       | Not applicable to role |
| 1     | Awareness | Understands concepts, needs guidance |
| 2     | Working   | Executes common tasks end-to-end |
| 3     | Advanced  | Designs solutions, reviews others |
| 4     | Expert    | Sets standards, mentors, leads complex work |

---

## Roadmap ideas

- [ ] Manager can review and override self-assessments
- [ ] Role profiles with target proficiency per role (gap analysis)
- [ ] Add/invite team members directly from the app
- [ ] Export heatmap to PDF / Excel
- [ ] Slack notifications for stale assessments
