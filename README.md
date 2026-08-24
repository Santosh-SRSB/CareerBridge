# Resume Builder

A full-stack resume builder:

- **Sign up / log in** (your resumes are private to your account)
- **Fill in your details once** — name, contact info, summary, experience, education, skills, projects, certifications
- **Pick a template** — two ATS-friendly (single-column, parser-safe) templates and two design-forward templates. Your content instantly re-renders into whichever template you choose, with no retyping.
- **Export to PDF** using your browser's print dialog.

```
resume-builder/
├── backend/     Node.js + Express API, stores data in a local JSON file (no native modules to install)
└── frontend/    React (Vite) app — the resume editor & template previews
```

You need two things running at once: the **backend** (the API/database) and the
**frontend** (the website you actually see). The steps below assume you've never
used VS Code, Node.js, or a terminal before — follow them in order.

---

## 1. Install the tools you need (one-time setup)

### 1a. Install Node.js
Node.js lets your computer run this project.

1. Go to https://nodejs.org
2. Download the **LTS** version (the button says "Recommended for most users")
3. Run the installer and click Next/Continue through the defaults
4. Restart your computer if it asks you to

To check it worked, open a terminal (see step 1c below) and type:
```
node -v
```
You should see something like `v20.x.x`. If you see an error, restart your computer and try again.

### 1b. Install VS Code
1. Go to https://code.visualstudio.com
2. Download and install it for your operating system (Windows/Mac/Linux)

### 1c. Open a terminal inside VS Code
You'll use this a lot, so it's worth knowing where it is:
- Open VS Code
- Go to the top menu: **Terminal → New Terminal**
- A panel opens at the bottom of the window — that's the terminal. You type commands there and press Enter to run them.

---

## 2. Open the project in VS Code

1. Unzip the `resume-builder` folder you downloaded, somewhere easy to find (e.g. your Desktop)
2. In VS Code: **File → Open Folder…**
3. Select the `resume-builder` folder (the one containing `backend` and `frontend`) and click Open

You should now see `backend` and `frontend` folders in the Explorer panel on the left.

---

## 3. Set up and run the backend (the API)

The backend is the part that stores accounts and resumes. It needs to be running
first, and needs to keep running the whole time you use the app.

1. Open a terminal in VS Code (**Terminal → New Terminal**)
2. Move into the backend folder:
   ```
   cd backend
   ```
3. Install its dependencies (downloads the libraries the code needs — only needed once):
   ```
   npm install
   ```
   This can take a minute. You'll see a `node_modules` folder appear — that's normal, leave it alone.
4. Create your local settings file. Copy `.env.example` to a new file named `.env`:
   - **Mac/Linux terminal:** `cp .env.example .env`
   - **Windows terminal:** `copy .env.example .env`
5. Start the backend:
   ```
   npm start
   ```
6. You should see:
   ```
   Resume Builder API running at http://localhost:4000
   ```
   **Leave this terminal open and running.** This is your database/API server.

A file called `resume_builder.db.json` will appear in the `backend` folder the
first time you register a user — that's your local database, no separate
install needed.

---

## 4. Set up and run the frontend (the website)

The frontend needs its **own** terminal, running at the same time as the backend.

1. Open a **second** terminal: click the **+** icon in the terminal panel (or **Terminal → New Terminal** again)
2. Move into the frontend folder:
   ```
   cd frontend
   ```
   (If your first terminal is still sitting inside `backend`, this second one starts fresh in the project root — just run `cd frontend` from there.)
3. Install its dependencies (only needed once):
   ```
   npm install
   ```
4. Start the frontend:
   ```
   npm run dev
   ```
5. You should see something like:
   ```
   VITE ready
   ➜  Local:   http://localhost:5173/
   ```
6. Hold Ctrl (Cmd on Mac) and click that `http://localhost:5173/` link, or copy it into your browser.

You should now see the Resume Builder website. Create an account, log in, and start building.

---

## 5. Everyday use (after the one-time setup)

Every time you want to work on/use the app:
1. Open the project folder in VS Code
2. Open a terminal → `cd backend` → `npm start`
3. Open a second terminal → `cd frontend` → `npm run dev`
4. Open `http://localhost:5173` in your browser

To stop everything, click into each terminal and press `Ctrl + C`.

---

## 6. How the template switching works

Your resume's content (name, experience, education, etc.) is stored once, as
structured data. Each template is just a different visual layout for that same
data — when you click a different template card in the editor, the preview on
the right instantly re-renders your existing details into that layout. Nothing
needs to be retyped, and switching templates never changes your wording.

- **ATS Minimal / ATS Classic** — single column, plain text, standard section
  headers, no tables/graphics — built to be read cleanly by applicant tracking
  systems (the software many companies use to scan resumes before a human sees them).
- **Modern Sidebar / Creative Bold** — more visually distinctive, better for
  emailing directly to a person, a portfolio, or design-adjacent roles. Some
  ATS parsers handle multi-column layouts less reliably, so use these when you
  know a human (not just a scanner) will read it first.

Use the **Export / Print PDF** button in the editor to save your resume as a PDF
via your browser's print dialog (choose "Save as PDF" as the destination).

---

## 7. Troubleshooting

- **"npm: command not found"** — Node.js isn't installed correctly. Redo step 1a and restart your computer.
- **Port already in use** — Something else is using port 4000 or 5173. Close other terminals running this project, or restart your computer.
- **Frontend loads but login/register fails** — make sure the backend terminal is still running and shows no errors. The frontend talks to it automatically.
- **Changed backend code and nothing changed** — stop the backend (`Ctrl + C`) and run `npm start` again.
- **`npm install` in `backend` fails with `node-gyp` / `Visual Studio` / `EPERM` errors (Windows)** — this shouldn't happen with the current version of this project. The backend now stores data in a plain JSON file (no native modules), specifically to avoid needing a C++ compiler on your machine. If you still hit this, delete the `node_modules` folder inside `backend` and run `npm install` again.

---

## 8. About the data model

This project implements a focused slice of the larger platform described in
your uploaded Application Build Guide (`resumes`, `resume_versions`-style
concept, and `users`) — scoped down to a standalone resume builder with
authentication and one JSON `data` blob per resume. Swapping the local SQLite
database for PostgreSQL later, or adding the guide's other modules
(employers, jobs, applications, AI matching, chat, etc.), can be layered on
top of this same backend structure without changing the frontend.
