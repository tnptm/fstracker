# Contributing to fstracker

Thanks for your interest in fstracker! Contributions are welcome, but they are accepted **only as pull requests** and every pull request is reviewed and merged by the maintainer, [@tnptm](https://github.com/tnptm).

## How to contribute

1. **Open an issue first** for anything larger than a small fix, so we can agree on the approach before you spend time on it.
2. **Fork** the repository and create a branch from the default branch (`master`), e.g. `feat/short-description` or `fix/short-description`.
3. **Make your change** and keep it focused: one logical change per pull request.
4. **Test it**:
   - Backend: `uv run --directory backend python manage.py test`
   - Frontend: `cd frontend && npm run lint && npm run build`
5. **Open a pull request** against `master` in `tnptm/fstracker`, describe what changed and why, and link any related issue.
6. **Wait for review.** The maintainer, [@tnptm](https://github.com/tnptm), is the only reviewer and will merge accepted pull requests. Feedback may ask for changes; please push them to the same branch.

## Rules

- Direct pushes to `master` are not accepted. Only the maintainer merges.
- Only pull requests are accepted. Patches sent by any other means (email, attachments, direct links to code) will not be applied.
- By opening a pull request you agree that your contribution is licensed under the [MIT License](LICENSE) that covers this project.
- Python dependencies are managed only with **uv** (`uv add <package>`). Do not use pip or edit `uv.lock` by hand.
- Follow the conventions in [CLAUDE.md](CLAUDE.md), including scoping every query to `request.user` and adding tests for new backend features.
- Keep pull requests free of secrets, `.env` files, database files and other local data.

## Reporting bugs and security issues

- For ordinary bugs, open an issue with steps to reproduce, the expected result and the actual result.
- For security vulnerabilities, please do **not** open a public issue. Contact the maintainer privately through GitHub instead.

Maintainer decisions on which pull requests to accept are final.
