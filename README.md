# Dream2Role 🚀

A Duolingo-style planner that turns **Dream Job + Current Skills + Time + Deadline** into a gamified roadmap.

## Features

- **Sign up / log in.** Email + password auth: passwords are hashed with bcrypt, sessions use JWT.
- **Front page setup flow** with 5 steps:
  1. **Dream job.** Pick from the catalog (Frontend Dev, Data Scientist, UX Designer, PM, Cloud/DevOps, Digital Marketer) or type your own.
  2. **Current skills.** Rate each skill from 🥚 Brand new to 🦅 Advanced. Lessons you already know are "tested out" and skipped.
  3. **Time.** Hours per week, from presets or a slider.
  4. **Deadline.** Optional.
  5. **Your plan.** Hours left, weeks needed, estimated finish date, and whether you'll make your deadline. If you won't, it shows how many hours per week you'd need.
- **Lesson notes.** Every lesson has a Notes tab next to the videos and tutorials, linking to that topic on trusted notes sites chosen per skill (e.g. W3Schools, GeeksforGeeks and MDN for web development; Khan Academy for statistics; Nielsen Norman Group for UX; Moz for SEO). Each link jumps straight to the site's best-matching page.
- **Learning path.** Each skill is a level made of lessons, laid out on a zig-zag path. Each lesson node has a progress ring, and lessons unlock in order.
- **Game mechanics.** XP (1 per minute studied, plus bonuses for finishing lessons and levels), player levels (Dreamer → Legend), a daily streak, a daily goal bar, a weekly bar with per-day columns, per-skill bars, and confetti celebrations.
- **Fun reminders.** A greeting toast, a 🔔 panel with playful nudges (e.g. when your streak is at risk), and optional browser notifications at a time you choose.
- **Friends Zone.** Send, accept and decline friend requests. A weekly leaderboard shows each friend's minutes vs. their weekly goal, a Mon–Sun activity chart, their streak and level. You can search for people by name.
- **Friend discovery.** "People you may know" suggestions, ranked by same dream job, shared skills and mutual friends. They also appear as a pop-up on the Learn page, at most once a day.

- **Compulsory level tests.** Every level ends with an MCQ test (8 questions, pass at 70%). The next level stays locked until you pass. Each answer is locked in on the server before the correct answer is shown, and a retake gets fresh questions.
- **Certifications sidebar** (🎓 in the nav). One certificate per level, plus a "Job-Ready <role>" capstone. Each one unlocks when you pass its level test. Pricing is **₹299 per certificate** or **₹699 for 3**. To get certified you pass an AI-generated exam (15 questions, 75%). Certificates have a public, printable verification page at `/certificate/<id>`.
- **Career hub** (💼 in the nav):
  - **Internship matches** unlock after passing half the level tests. The AI suggests internship types you're eligible for, why you fit, skills to highlight, gaps to close, and search links.
  - **AI project ideas** unlock after the first level test. Each one includes the full tech stack, features, milestones, ways to use AI to build it, and a portfolio tip.
  - **AI resume builder.** It writes a one-page resume in the format your target internship's field expects and pulls in your skills and certificates. You can download it as a PDF through the print dialog.

- **Rolo, the AI coach** (🚀 "Ask Rolo" button on every page). A chat assistant that knows your dream job, plan, deadline, streak, next lesson, level tests and certificates. It explains topics, plans your study time, helps you prep for tests (without giving away answers) and points you to the right part of the app. Replies stream in as they're written.

All AI features go through `server/ai.ts`, which supports Google Gemini and OpenAI: structured JSON output for tests, internships, projects and resumes, and streaming for the coach.

## Configuration

Copy `.env.example` to `.env` and fill in your keys. The server loads `.env` on startup. It's git-ignored, so keys never get committed. You can also set these as normal environment variables.

| Variable | What it does |
| --- | --- |
| `GEMINI_API_KEY` | Turns on the AI features with Google Gemini (free key at aistudio.google.com/apikey). Used first if both AI keys are set. |
| `GEMINI_MODEL` | Optional Gemini model (default `gemini-flash-latest`). If a model is retired or unavailable to your key, the app switches to the newest working Flash model automatically. |
| `OPENAI_API_KEY` | Alternatively, turns on the AI features with OpenAI (needs billing credits). |
| `OPENAI_MODEL` | Optional OpenAI model (default `gpt-5.4-mini`). |

Without an AI key, tests, internships, projects and resumes use simple offline content marked "practice mode" or "offline", and the coach explains it isn't connected. On startup the server prints whether AI is working, or exactly why not.
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Real payments through Razorpay Checkout. Without them, development uses a **demo checkout that charges nothing**, and production disables payments (unless `DEMO_PAYMENTS=1`). |
| `JWT_SECRET` | Required in production. |
| `DATA_FILE` | Where to store the JSON database (default `server/data/db.json`). |

## Run it

```bash
npm install
npm run seed   # optional: adds 6 demo learners (password: demo1234), e.g. aarav@demo.dream2role
npm run dev    # API on :3001, web app on http://localhost:5173
```

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run build` + `npm start` (serves the built app and API from one port; set `JWT_SECRET` in production).

## Deploy (Render, free)

The repo includes a `render.yaml` blueprint that deploys the whole app (frontend + API) as one web service.

1. Sign in at [render.com](https://render.com) with GitHub.
2. **New → Blueprint**, pick this repository and the `claude/dream-job-skill-roadmap-jd6ti4` branch.
3. When asked for `GEMINI_API_KEY`, paste your key (it stays in Render, not in git). Click **Apply**.
4. After the build finishes (a few minutes), open the `https://<name>.onrender.com` URL.

The blueprint sets `NODE_ENV=production`, a generated `JWT_SECRET`, `DEMO_PAYMENTS=1` (demo checkout, no real charges) and `SEED_DEMO=1` (demo learners such as `aarav@demo.dream2role` / `demo1234`).

Free-tier notes: the service sleeps after ~15 minutes idle, so the first visit can take ~50 seconds to wake. Data is stored in a file that resets on each redeploy or restart, so treat the hosted app as a demo (attach a persistent disk or a database for real users).

Manual setup on any Node host: build with `npm ci --include=dev && npm run build`, start with `npm start`, and set the environment variables above.

## Structure

```
shared/   role catalog, time estimate, XP/streak/levels, certificates & pricing, reminder copy
server/   Express API, JSON-file storage, AI (ai.ts, coach.ts), payments (payments.ts), tests/certs/career routes (career.ts)
src/      React app: pages (Landing, Setup, Learn, Friends) and components
tests/    unit tests for the planning/game logic and API tests
```

## Notes / next steps

- Storage is a single JSON file, which is fine for a prototype. Swap `server/db.ts` for a real database before going live.
- The Razorpay integration follows Razorpay's standard order and signature-verification flow but hasn't been tested against live keys yet. Test it in Razorpay's test mode first, and add a webhook (`payment.captured`) so a payment still counts if the browser closes mid-checkout.
- Browser reminders only fire while the app is open in a tab. For reminders when it's closed, add web push (service worker + push server) or email.
- The skill hours in `shared/catalog.ts` are rough estimates. Tune them, or add more roles.
