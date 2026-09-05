#!/bin/bash
# PostToolUse hook (Write|Edit): after a source or test file changes, typecheck
# and run the fast tests. Exit 2 + stderr is the Claude Code convention for
# "block and feed this back to Claude" -- so a failure lands in the model's
# context automatically, without the user needing to paste it in.
#
# Fast tests only, deliberately. The full suite takes about twenty seconds and
# all but half a second of that is one file: tests/balance.test.ts plays whole
# twenty-round campaigns against every named build, at module load. That is the
# measurement this project's design rests on, but it answers a question about
# balance, not about whether the edit just made compiles and behaves -- and a
# twenty-second pause after every edit turns the hook into something to switch
# off.
#
# `npm test` runs the balance sweeps too, and so does CI: on every pull request,
# and again on main before it will deploy.
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
  echo "(This is npm run test:fast; tests/balance.test.ts is excluded. Run npm test for it.)" >&2
  exit 2
fi
