import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Tests capture a session cookie once at login and reuse it for a whole test.
// Session rotation revokes that cookie when the wall clock moves more than the
// production threshold (30 min). A suspended/forward-jumped host during a long
// suite can therefore invalidate a live test mid-way. Keep rotation out of the
// test environment; production behaviour is unchanged.
process.env.SESSION_ROTATE_AFTER_MINUTES = "52560000";
