# CareerBridge

AI employability platform. Current slice: **login, registration, and JWT authentication** with Firebase Phone OTP.

## Run locally

PostgreSQL 18 is used from:

`C:\Program Files\PostgreSQL\18`

A CareerBridge data directory lives at `.postgres-data` (gitignored) on **port 5434**.

Start the local database (once per reboot):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Users\SRSB HR SOLUTIONS\CareerBridge\.postgres-data" -l "C:\Users\SRSB HR SOLUTIONS\CareerBridge\.postgres-data\logfile" -o "-p 5434" start
```

Connection string in `apps/api/.env`:

`postgresql://careerbridge:careerbridge@127.0.0.1:5434/careerbridge?schema=public`

Then:

1. `npm install` from the repo root
2. From `apps/api`: `npx prisma db push`
3. Start API and web:

```bash
cd apps/api
npm run start:dev
```

```bash
cd apps/web
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1/health
- Swagger: http://localhost:3001/api/docs

## Firebase OTP local setup

Mobile OTP uses **Firebase Phone Authentication**. Email OTP is sent to the inbox with Gmail SMTP (not the API terminal).

### Email OTP (Gmail)

1. Open [Google Account → Security](https://myaccount.google.com/security) and turn on **2-Step Verification**.
2. Open [App passwords](https://myaccount.google.com/apppasswords) and create one named `CareerBridge`.
3. Put these in `apps/api/.env` (use the 16-character app password, not your normal Gmail password):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=CareerBridge <your-gmail@gmail.com>
```

4. Restart the API. On `/register` choose **Email OTP**. The code arrives in the inbox (check spam).

### 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or use an existing project).
3. Turn Google Analytics off unless you want it.
4. Open the project.

### 2. Register a Web app

1. Project overview → the **Web** icon (`</>`), or **Project settings → General → Add app → Web**.
2. App nickname: `CareerBridge web`.
3. Do **not** tick Firebase Hosting for local work.
4. Register app.
5. Copy these values from the `firebaseConfig` snippet:

| firebaseConfig field | env variable in `apps/web/.env.local` |
| --- | --- |
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

### 3. Enable Phone sign-in

1. **Build → Authentication → Get started** (if prompted).
2. **Sign-in method → Phone → Enable → Save**.

### 4. Allow localhost

1. **Authentication → Settings → Authorized domains**.
2. Confirm `localhost` is in the list. Add it if it is missing.

### 5. Add a test phone number (no real SMS, no billing)

Use this for local development so Firebase does not send a real SMS.

1. **Authentication → Sign-in method → Phone**.
2. Open **Phone numbers for testing**.
3. Add a number in E.164, for example `+919876543210`.
4. Set a 6-digit code, for example `654321`.
5. **Add**.

Do not use a number you already created as a real Firebase user. Do not use your personal number as a test number.

### 6. Create a service account for the API

The API verifies the Firebase ID token after the user enters the SMS code.

1. **Project settings → Service accounts**.
2. Confirm **Firebase Admin SDK** / Node.js.
3. **Generate new private key** → download the JSON.
4. Map JSON fields into `apps/api/.env`:

| service account JSON | env variable in `apps/api/.env` |
| --- | --- |
| `project_id` | `FIREBASE_PROJECT_ID` |
| `client_email` | `FIREBASE_CLIENT_EMAIL` |
| `private_key` | `FIREBASE_PRIVATE_KEY` |

Keep `FIREBASE_PRIVATE_KEY` in double quotes and keep the `\n` characters. Example:

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Keep that JSON file off git. Do not commit `.env` files.

### 7. Fill local env files

`apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_AUTH_DEV_OTP=false
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

`apps/api/.env`:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=file:./dev.db
JWT_ACCESS_SECRET=careerbridge-dev-access-secret-change-me
JWT_REFRESH_SECRET=careerbridge-dev-refresh-secret-change-me
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
WEB_ORIGIN=http://localhost:3000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
AUTH_DEV_OTP=false
```

`AUTH_DEV_OTP` and `NEXT_PUBLIC_AUTH_DEV_OTP` must both be `false` to use Firebase. If either is `true`, the app skips Firebase and accepts **123456**.

### 8. Restart both apps

Next.js and Nest only read env files at startup.

- Stop and start `apps/web` (`npm run dev`)
- Stop and start `apps/api` (`npm run start:dev`)

### 9. Try it

1. Open http://localhost:3000/register
2. Choose **Mobile OTP**
3. Enter the **same test phone number** you added in Firebase
4. Fill the other fields and send OTP
5. Enter the **test code** (for example `654321`), not `123456`

For **real** SMS to a live phone, upgrade the Firebase project to Blaze. Test numbers work on Spark.

## Auth flow

1. App calls `POST /api/v1/auth/otp/request` (rate-limited).
2. For **mobile**, Firebase sends (or simulates) the SMS; the browser confirms the code and gets a Firebase ID token.
3. App calls `POST /api/v1/auth/otp/verify` with that ID token.
4. API verifies the token with Firebase Admin, creates/finds the user, and issues **JWT access + refresh** tokens.
5. Protected routes use `Authorization: Bearer <accessToken>`.

Email OTP still uses a server code. With Firebase mode on, that code is printed in the API terminal until an email provider is added.
