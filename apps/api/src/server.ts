import "dotenv/config";
import { app } from "./app.js";

// Fail at startup, not on the first request, if config is missing.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Copy .env.example to .env.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
