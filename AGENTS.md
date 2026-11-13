# Working on Neo Glide

- Normal development belongs on **Dev**, with that exact capitalization. Preserve
  existing uncommitted work when switching branches. Do not work directly on main.
- Integrate releases through a **Dev → main** pull request. Main is protected and
  merges invoke the release pipeline. Do not bypass required status checks.
- Read [docs/CI_CD.md](docs/CI_CD.md) for workflow operation, versioning, signing,
  review gates and recovery. package.json is the marketing-version source.
- Never commit signing keys, passwords, API private keys, environment-specific
  backend configuration, built packages or diagnostic account screenshots.
- Preserve outstanding store reviews. Do not acknowledge a Play review result
  without checking that exact build's actual final status in Play Console.
