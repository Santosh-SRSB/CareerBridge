#!/usr/bin/env python3
"""Generate CareerBridge Candidate Journey documentation PDF."""

from fpdf import FPDF
from datetime import date

OUTPUT = r"C:\Users\SRSB HR SOLUTIONS\CareerBridge\CareerBridge - Candidate Journey (Naya Flow).pdf"


def ascii_safe(text: str) -> str:
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2192", "->")
        .replace("\u00d7", "x")
        .replace("\u20b9", "Rs.")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


class Doc(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "CareerBridge - Candidate Journey Documentation", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()} / {{nb}}", align="C")

    def title_page(self):
        self.add_page()
        self.set_font("Helvetica", "B", 26)
        self.set_text_color(10, 46, 44)
        self.ln(40)
        self.multi_cell(0, 12, "CareerBridge\nCandidate Journey", align="C")
        self.ln(8)
        self.set_font("Helvetica", "", 14)
        self.set_text_color(60, 60, 60)
        self.multi_cell(
            0,
            8,
            "Ab tak kya banaya hai aur kaise use hota hai\n(Login, Registration, Onboarding, Dashboard, Profile)",
            align="C",
        )
        self.ln(20)
        self.set_font("Helvetica", "", 11)
        self.cell(0, 8, f"Branch: features/candidatepartsprint1", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 8, f"Date: {date.today().strftime('%d %B %Y')}", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 8, "SRSB HR Solutions", align="C")

    def h1(self, text):
        text = ascii_safe(text)
        self.ln(4)
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(10, 46, 44)
        self.multi_cell(0, 9, text)
        self.ln(2)

    def h2(self, text):
        text = ascii_safe(text)
        self.ln(2)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(13, 148, 136)
        self.multi_cell(0, 7, text)
        self.ln(1)

    def body(self, text):
        text = ascii_safe(text)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def bullet(self, text):
        text = ascii_safe(text)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(30, 30, 30)
        self.multi_cell(0, 5.5, f"  - {text}")

    def code(self, text):
        text = ascii_safe(text)
        self.set_x(self.l_margin)
        self.set_font("Courier", "", 9)
        self.set_text_color(50, 50, 50)
        self.multi_cell(0, 5, text)
        self.set_font("Helvetica", "", 10)
        self.ln(1)

    def table_row(self, cols, widths, bold=False):
        cols = [ascii_safe(str(c)) for c in cols]
        style = "B" if bold else ""
        self.set_font("Helvetica", style, 8)
        h = 7
        x0 = self.get_x()
        y0 = self.get_y()
        for col, w in zip(cols, widths):
            x = self.get_x()
            y = self.get_y()
            self.multi_cell(w, h, col, border=1, max_line_height=h)
            self.set_xy(x + w, y)
        self.set_xy(x0, y0 + h)
        self.ln(1)


def build():
    pdf = Doc()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.title_page()

    # 1. Overview
    pdf.add_page()
    pdf.h1("1. Overview (Sankshipt)")
    pdf.body(
        "Ye document CareerBridge ke naye Candidate Journey ko explain karta hai - "
        "wo flow jo aapne features/candidatepartsprint1 branch par banaya hai. "
        "Isme candidate register karta hai, OTP verify karta hai, 4-step onboarding "
        "complete karta hai, phir dashboard aur profile use karta hai."
    )
    pdf.h2("Poora flow ek line mein")
    pdf.code(
        "Register -> OTP Verify -> Onboarding (4 steps) -> Dashboard -> Profile / Skills"
    )
    pdf.h2("Tech Stack")
    pdf.bullet("Frontend: Next.js (apps/web) - port 3000")
    pdf.bullet("Backend API: NestJS (apps/api) - port 3001")
    pdf.bullet("Database: PostgreSQL + Prisma ORM")
    pdf.bullet("Shared types: packages/shared (@careerbridge/shared)")
    pdf.bullet("Auth: JWT tokens + OTP (Dev / Email / Firebase Mobile)")

    # 2. How to run
    pdf.h1("2. Kaise Run Karein (Local Setup)")
    pdf.h2("Step 1: Environment files")
    pdf.body("Do files zaroori hain:")
    pdf.code("apps/api/.env\napps/web/.env.local")
    pdf.h2("Step 2: Dev OTP (Testing ke liye sabse aasaan)")
    pdf.body("Local testing ke liye dono files mein ye set karein:")
    pdf.code("AUTH_DEV_OTP=true                    # apps/api/.env\nNEXT_PUBLIC_AUTH_DEV_OTP=true        # apps/web/.env.local")
    pdf.body("Is mode mein koi bhi OTP enter karein: 123456")
    pdf.h2("Step 3: Shared package build")
    pdf.code("npm run build --workspace=@careerbridge/shared")
    pdf.h2("Step 4: Start servers")
    pdf.code("npm run dev    # ya alag-alag API + Web start karein")
    pdf.body("URLs:")
    pdf.bullet("Web: http://localhost:3000")
    pdf.bullet("API: http://localhost:3001/api/v1")

    # 3. Auth flow
    pdf.add_page()
    pdf.h1("3. Login & Registration (Kaise kaam karta hai)")
    pdf.h2("3.1 Registration - /register?role=candidate")
    pdf.body("Candidate naya account banata hai. Fields:")
    pdf.bullet("Full Name")
    pdf.bullet("Mobile Number (country code ke saath)")
    pdf.bullet("Email")
    pdf.bullet("OTP Channel: Mobile ya Email choose karein")
    pdf.bullet("Terms & Conditions checkbox")
    pdf.body("Submit par API call hoti hai: POST /auth/otp/request (purpose=REGISTER)")
    pdf.body("Phir user /verify-otp page par jata hai.")

    pdf.h2("3.2 OTP Verify - /verify-otp")
    pdf.body("6-digit OTP enter karein. API: POST /auth/otp/verify")
    pdf.body("Register ke baad:")
    pdf.bullet("Session save hoti hai (JWT tokens + user info)")
    pdf.bullet("onboardingCompleted = false set hota hai")
    pdf.bullet("Redirect: /onboarding (Step 1)")
    pdf.body("Login ke baad:")
    pdf.bullet("Agar onboarding incomplete -> /onboarding")
    pdf.bullet("Agar complete -> /dashboard")

    pdf.h2("3.3 Login - /login")
    pdf.body("Existing candidate mobile ya email se OTP login kar sakta hai.")
    pdf.bullet("Mobile OTP: PhoneAuthForm")
    pdf.bullet("Email OTP: email field + OTP")
    pdf.body("API: POST /auth/otp/request (purpose=LOGIN)")

    pdf.h2("3.4 Session Storage (Browser mein kya save hota hai)")
    pdf.bullet("localStorage: cb_access_token, cb_refresh_token, cb_user")
    pdf.bullet("Cookie: cb_auth=1")
    pdf.bullet("sessionStorage: cb_otp_flow (OTP flow ke dauran)")

    # 4. Onboarding
    pdf.add_page()
    pdf.h1("4. Onboarding - 4 Steps (Naya Flow)")
    pdf.body(
        "Registration ke baad candidate ko 4 steps complete karne hote hain. "
        "Har step par 'Continue' aur 'Skip for now' button hai. "
        "Skip karne par bhi agla step open hota hai; last step par skip se dashboard mil jata hai."
    )

    w = [16, 38, 52, 74]
    pdf.table_row(["Step", "Route", "Question", "Database mein save"], w, bold=True)

    steps = [
        ("1", "/onboarding", "Current city + Work city", "city, preferredWorkCity, openToRelocating"),
        ("2", "/onboarding/name", "Domain (IT, Finance...)", "careerInterests[]"),
        ("3", "/onboarding/education", "Highest education", "highestEducation + education row"),
        ("4", "/onboarding/experience", "Work experience?", "hasExperience, experience rows"),
    ]
    for row in steps:
        pdf.table_row(list(row), w)

    pdf.ln(4)
    pdf.h2("Step 1 - Location")
    pdf.bullet("Where are you currently located? -> City dropdown")
    pdf.bullet("Where would you like to work? -> Ek city dropdown")
    pdf.bullet("API: PATCH /candidates/me")

    pdf.h2("Step 2 - Domain")
    pdf.bullet("Options: IT, Non-IT, Finance, Healthcare, Retail, Operations, Manufacturing, Other")
    pdf.bullet("'Other' par text input dikhta hai")
    pdf.bullet("API: PATCH /candidates/me { careerInterests: [domain] }")

    pdf.h2("Step 3 - Education")
    pdf.bullet("Options: 10th, 12th, Diploma, Graduate, Postgraduate, Other")
    pdf.bullet("'Other' par custom education likh sakte hain")
    pdf.bullet("API: PATCH /candidates/me + POST /candidates/me/education")

    pdf.h2("Step 4 - Experience")
    pdf.bullet("Yes / No / Internship")
    pdf.bullet("Yes par: Company, Job title, Years, From-To dates")
    pdf.bullet("Finish setup par onboardingCompleted = true")
    pdf.bullet("Redirect: /dashboard")

    # 5. Dashboard
    pdf.add_page()
    pdf.h1("5. Dashboard - /dashboard")
    pdf.body("Onboarding complete hone ke baad candidate ka home page.")
    pdf.h2("Kya dikhta hai")
    pdf.bullet("Welcome message (candidate name)")
    pdf.bullet("Profile completion % (5 sections x 20% each)")
    pdf.bullet("Recommended Jobs - horizontal scroll, 5 job cards + See all")
    pdf.bullet("Upcoming Interview section (Eagle mascot animation)")
    pdf.h2("Gate Logic")
    pdf.bullet("Agar login nahi -> /login redirect")
    pdf.bullet("Agar onboarding incomplete -> /onboarding redirect")
    pdf.body("API calls: GET /candidates/me, GET /candidates/me/completion, GET /jobs/recommended")

    pdf.h1("6. Profile / Passport - /passport aur /profile")
    pdf.body("/profile same hai /passport ka. Career Passport candidate ki poori profile hai.")
    pdf.h2("5 Main Sections (har ek 20%)")
    pdf.bullet("Personal Info -> /passport/personal")
    pdf.bullet("Education -> /passport/education")
    pdf.bullet("Experience -> /passport/experience")
    pdf.bullet("Skills (minimum 3) -> /passport/skills")
    pdf.bullet("Preferences -> /passport/preferences")
    pdf.h2("Extra sections")
    pdf.bullet("Photo, Languages, Certifications, Projects, Links")

    pdf.h1("7. Mobile Navigation (CandidateAppShell)")
    pdf.body("Dashboard aur baaki candidate pages par bottom navigation:")
    pdf.bullet("Home -> /dashboard")
    pdf.bullet("Jobs -> /jobs")
    pdf.bullet("Applications -> /applications")
    pdf.bullet("Interviews -> /interviews")
    pdf.bullet("Profile -> /passport")

    # 6. API
    pdf.add_page()
    pdf.h1("8. API Endpoints (Backend)")
    pdf.body("Base URL: http://localhost:3001/api/v1")
    pdf.h2("Auth")
    pdf.bullet("POST /auth/otp/request - OTP bhejna (register/login)")
    pdf.bullet("POST /auth/otp/verify - OTP verify + tokens")
    pdf.bullet("GET /auth/me - Current user check")
    pdf.bullet("POST /auth/refresh - Token refresh")
    pdf.bullet("POST /auth/logout - Sign out")

    pdf.h2("Candidate Profile")
    pdf.bullet("GET /candidates/me - Poori profile")
    pdf.bullet("PATCH /candidates/me - Profile update (onboarding steps)")
    pdf.bullet("GET /candidates/me/completion - Completion %")
    pdf.bullet("POST /candidates/me/education")
    pdf.bullet("POST /candidates/me/experience")
    pdf.bullet("POST /candidates/me/skills")
    pdf.bullet("DELETE /candidates/me/skills/:id")

    pdf.h2("Jobs (Dashboard)")
    pdf.bullet("GET /jobs/recommended")
    pdf.bullet("GET /jobs?limit=8")

    # 7. Key files
    pdf.h1("9. Important Files (Developer Reference)")
    pdf.h2("Frontend Pages")
    pdf.code(
        "apps/web/src/app/register/page.tsx\n"
        "apps/web/src/app/login/page.tsx\n"
        "apps/web/src/app/verify-otp/page.tsx\n"
        "apps/web/src/app/onboarding/page.tsx (+ name, education, experience)\n"
        "apps/web/src/app/dashboard/page.tsx\n"
        "apps/web/src/app/passport/page.tsx"
    )
    pdf.h2("Components")
    pdf.code(
        "RegistrationForm.tsx    - Register form\n"
        "PhoneAuthForm.tsx         - Login OTP\n"
        "OnboardingFrame.tsx       - 4-step UI shell\n"
        "CandidateAppShell.tsx     - Header + bottom nav\n"
        "AuthShell.tsx             - Login/Register layout\n"
        "CitySelect.tsx            - City dropdown"
    )
    pdf.h2("Logic / Hooks")
    pdf.code(
        "lib/onboarding-flow.ts    - Step routes\n"
        "hooks/useOnboardingGate.ts - Auth + onboarding guard\n"
        "lib/session.ts              - Token storage\n"
        "lib/phone.ts                - postAuthPath redirect\n"
        "lib/api.ts                  - All API calls"
    )
    pdf.h2("Backend")
    pdf.code(
        "apps/api/src/auth/auth.service.ts\n"
        "apps/api/src/candidates/candidates.service.ts\n"
        "apps/api/src/locations/          - States/cities API\n"
        "packages/shared/src/candidate.ts - ONBOARDING_DOMAINS etc."
    )

    # 8. Env vars table
    pdf.add_page()
    pdf.h1("10. Environment Variables")
    pdf.h2("apps/api/.env (Zaroori)")
    w2 = [50, 130]
    pdf.table_row(["Variable", "Purpose"], w2, bold=True)
    env_api = [
        ("PORT=3001", "API port"),
        ("DATABASE_URL", "PostgreSQL connection"),
        ("JWT_ACCESS_SECRET", "Access token secret"),
        ("JWT_REFRESH_SECRET", "Refresh token secret"),
        ("WEB_ORIGIN", "CORS - http://localhost:3000"),
        ("AUTH_DEV_OTP=true", "Dev OTP = 123456"),
        ("SMTP_*", "Email OTP (production)"),
        ("FIREBASE_*", "Mobile OTP (production)"),
    ]
    for row in env_api:
        pdf.table_row(list(row), w2)

    pdf.ln(4)
    pdf.h2("apps/web/.env.local (Zaroori)")
    pdf.table_row(["Variable", "Purpose"], w2, bold=True)
    env_web = [
        ("NEXT_PUBLIC_API_URL", "http://localhost:3001/api/v1"),
        ("NEXT_PUBLIC_AUTH_DEV_OTP=true", "Frontend dev OTP mode"),
        ("NEXT_PUBLIC_FIREBASE_*", "Firebase mobile OTP"),
    ]
    for row in env_web:
        pdf.table_row(list(row), w2)

    # 9. Database
    pdf.h1("11. Database - Candidate Fields")
    pdf.body("Prisma model: Candidate (PostgreSQL)")
    pdf.bullet("firstName, lastName, phone (via User), email")
    pdf.bullet("city, preferredWorkCity, openToRelocating")
    pdf.bullet("careerInterests (JSON array - domain)")
    pdf.bullet("highestEducation, hasExperience")
    pdf.bullet("totalExperienceYears, totalExperienceMonths")
    pdf.bullet("onboardingCompleted (true/false)")
    pdf.bullet("profileCompletion (0-100%)")
    pdf.body("Related tables: candidate_education, candidate_skills, candidate_experiences")

    # 10. Shared constants
    pdf.h1("12. Shared Constants (@careerbridge/shared)")
    pdf.bullet("ONBOARDING_DOMAINS: IT, Non-IT, Finance, Healthcare, Retail, Operations, Manufacturing, Other")
    pdf.bullet("EDUCATION_LEVELS: 10th, 12th, Diploma, Graduate, Postgraduate, Other")
    pdf.bullet("EXPERIENCE_OPTIONS: Yes, No, Internship")
    pdf.bullet("PROFILE_SKILLS_TARGET_COUNT: 3 skills for 100% skills section")
    pdf.body("Note: shared package change ke baad npm run build --workspace=@careerbridge/shared zaroor chalayein.")

    # 11. Branch note
    pdf.h1("13. Git Branch Status")
    pdf.body("Poora naya candidate flow abhi features/candidatepartsprint1 branch par hai.")
    pdf.body("Dev branch par sirf kuch files selectively push hui thi - isliye dev par run karne par UI alag dikh sakta hai.")
    pdf.body("Local development ke liye features/candidatepartsprint1 branch use karein.")

    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(
        0,
        5,
        "Document auto-generated from CareerBridge codebase.\n"
        "For questions: SRSB HR Solutions | CareerBridge Team",
        align="C",
    )

    pdf.output(OUTPUT)
    print(f"PDF created: {OUTPUT}")


if __name__ == "__main__":
    build()
