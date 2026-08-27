import { exec } from "node:child_process";

const run = (cmd) => new Promise((resolve, reject) => exec(
  cmd,
  (error, stdout, stderr) => {
    if (error) reject(new Error(stderr || stdout || error.message));
    else resolve(stdout);
  }
));

// Lint + format staged files; aborts the commit if this fails.
try {
  const output = await run('npx lint-staged');
  console.log(output);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const changeset = await run('git diff --cached --name-only --diff-filter=ACMR');
const modifiedFiles = changeset.split('\n').filter(Boolean);

// check if there are any model files staged
const modifledPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*.json/));
if (modifledPartials.length > 0) {
  const output = await run('npm run build:json --silent');
  console.log(output);
  await run('git add component-models.json component-definition.json component-filters.json');
}
