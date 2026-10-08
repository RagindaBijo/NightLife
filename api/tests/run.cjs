// Runs the API test suites against the worker running locally.
//   npm test              → all suites
//   npm test -- social    → only suites whose file name contains "social"
// Each suite gets a fresh, empty test database (live data is never touched).
const fs = require("fs");
const path = require("path");
const { resetDatabase, startServer, createContext } = require("./helpers.cjs");

(async () => {
  const filter = process.argv[2];
  const suites = fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith(".test.cjs") && (!filter || file.includes(filter)))
    .sort();

  let passed = 0;
  let failed = 0;
  for (const file of suites) {
    console.log(`\n▶ ${file}`);
    resetDatabase();
    const server = await startServer();
    const ctx = createContext();
    try {
      await require(path.join(__dirname, file))(ctx);
    } catch (err) {
      ctx.results.failed += 1;
      console.log(`  FAIL crashed: ${err.stack || err.message}`);
    } finally {
      await server.stop();
    }
    passed += ctx.results.passed;
    failed += ctx.results.failed;
  }

  console.log(`\n${passed} passed, ${failed} failed (${suites.length} suites)`);
  process.exit(failed ? 1 : 0);
})();
