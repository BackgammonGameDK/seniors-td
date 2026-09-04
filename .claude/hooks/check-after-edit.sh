#!/bin/bash
# PostToolUse hook (Write|Edit): after a source or test file changes, typecheck
# and run the fast tests. Exit 2 + stderr is the Claude Code convention for
# "block and feed this back to Claude" -- so a failure lands in the model's
# context automatically, without the user needing to paste it in.
#
# Fast tests only, deliberately. The full suite takes ~55 seconds, and all but
# half a second of that is two files: tests/diversity.test.ts runs a 720-build
# campaign sample at module load, and tests/campaign.test.ts plays twenty
# rounds on several seeds. Those are the measurements this project is built
# on, but they answer a question about balance, not about whether the edit
# just made compiles and behaves -- and a 55-second pause after every keystroke
# turns the hook into something to switch off. `npm run test:sampled` runs a
# 120-build sample in ~8 seconds if you want a smoke check on a balance edit;
# `npm test` runs everything, and CI runs it on every push before it will
# deploy.
set -uo pipefail

project="${CLAUDE_PROJECT_DIR:-/Users/markuskragh/Documents/Claude/seniors-td}"
file="$(jq -r '.tool_input.file_path // empty')"

case "$file" in
  "$project"/src/*.ts | "$project"/tests/*.ts) ;;
  *) exit 0 ;;
esac

cd "$project" || exit 0

output="$(npm run typecheck --silent 2>&1 && npm run test:fast --silent 2>&1)"
status=$?

if [ "$status" -ne 0 ]; then
  echo "typecheck/fast tests failed after editing $file:" >&2
  echo "$output" >&2
  echo "(This is npm run test:fast; the campaign and diversity suites are excluded. Run npm test for those.)" >&2
  exit 2
fi
