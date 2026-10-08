// Adds a few demo learners so friend suggestions and the leaderboard have someone in them.
// Usage: npm run seed   (all demo accounts use the password "demo1234")
import "./env.ts"; // must come first: loads .env before other modules read settings
import { seedDemo } from "./demo.ts";

const n = await seedDemo();
console.log(`Seeded ${n} demo learners (password: demo1234)`);
