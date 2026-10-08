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
- **Learning path.** Each skill is a level made of lessons, laid out on a zig-zag path. Each lesson node has a progress ring, and lessons unlock in order.
- **Game mechanics.** XP (1 per minute studied, plus bonuses for finishing lessons and levels), player levels (Dreamer → Legend), a daily streak, a daily goal bar, a weekly bar with per-day columns, per-skill bars, and confetti celebrations.
- **Fun reminders.** A greeting toast, a 🔔 panel with playful nudges (e.g. when your streak is at risk), and optional browser notifications at a time you choose.
- **Friends Zone.** Send, accept and decline friend requests. A weekly leaderboard shows each friend's minutes vs. their weekly goal, a Mon–Sun activity chart, their streak and level. You can search for people by name.
- **Friend discovery.** "People you may know" suggestions, ranked by same dream job, shared skills and mutual friends. They also appear as a pop-up on the Learn page, at most once a day.

## Run it

```bash
npm install
npm run seed   # optional: adds 6 demo learners (password: demo1234), e.g. aarav@demo.dream2role
npm run dev    # API on :3001, web app on http://localhost:5173
```

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run build` + `npm start` (serves the built app and API from one port; set `JWT_SECRET` in production).

## Structure

```
shared/   role catalog, time estimate, XP/streak/levels, reminder copy (used by server and client)
server/   Express API, JSON-file storage (server/data/db.json), seed script
src/      React app: pages (Landing, Setup, Learn, Friends) and components
tests/    unit tests for the planning/game logic and API tests
```

## Notes / next steps

- Storage is a single JSON file, which is fine for a prototype. Swap `server/db.ts` for a real database before going live.
- Browser reminders only fire while the app is open in a tab. For reminders when it's closed, add web push (service worker + push server) or email.
- The skill hours in `shared/catalog.ts` are rough estimates. Tune them, or add more roles.
