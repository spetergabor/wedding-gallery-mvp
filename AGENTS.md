# Spetly delivery workflow

- When the user asks to implement, change, fix, or build something, finish and verify the scoped work, then commit it and push it to `origin/main` without requiring a separate "push" request.
- After pushing, verify the Vercel deployment status and report whether production deployment completed successfully.
- Do not commit, push, or deploy when the user explicitly asks only for planning, review, diagnosis, or a report, or explicitly says not to publish yet.
- Never include unrelated user changes in a commit. If unrelated changes prevent a safe isolated commit, stop and explain the conflict.
