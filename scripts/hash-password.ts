// Usage: npm run hash-password -- "your-strong-password"
// Prints the value for ADMIN_PASSWORD_HASH_B64.
import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error('Pass a password of at least 12 characters: npm run hash-password -- "..."');
  process.exit(1);
}
const hash = bcrypt.hashSync(pw, 12);
console.log(`ADMIN_PASSWORD_HASH_B64="${Buffer.from(hash).toString("base64")}"`);
