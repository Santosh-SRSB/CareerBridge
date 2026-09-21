# Resume extraction fixtures

Place these files here (repo root `test/fixtures/`):

| File | Source |
|------|--------|
| `original-resume.pdf` | Nagendra original upload (`NagendraMahto_resume_04_2026.pdf`) |
| `portal-downloaded-resume.pdf` | Corrupted portal download (`IT-Resume__8_.pdf`) |

Integration tests look for these names under:

- `test/fixtures/` (repo root)
- `apps/api/test/fixtures/`

If missing, fixture tests **skip** (do not fail). Isolation unit tests always run.
