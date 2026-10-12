# Local 120-student survey verification

Run `node scripts/verify-survey-load.mjs` after starting the API at
`http://127.0.0.1:3012` against a disposable MariaDB database named
`codex_survey_load_test`. Expose that database only on `127.0.0.1:33082`, and set
`SURVEY_LOAD_DB_PASSWORD` to its local root password. The API must have completed
its normal schema and assessment seed initialization first.

The host, API port, database port, and database name are fixed in the script to
prevent accidentally running it against a deployed system. Every run creates a
new synthetic activity and 120 new synthetic students; dispose of the test
database afterward. The script does not read application `.env` files.

The bounded run verifies registration, two image downloads per student, nine
draft saves, reload retention, simultaneous duplicate submissions, results,
1,200 persisted telemetry events, repeated entry, token pruning, and invalid or
expired sessions. It creates a valid JPEG fixture from an existing repository
image using JPEG comment segments, resulting in an approximately 2.4 MB base64
database field. Requests use one shared client IP to model campus Wi-Fi.

The report is written to `outputs/full-load-120-report.json`. It contains counts,
timings, and assertions without student identities, access tokens, or passwords.
This is an HTTP/API simulation on local hardware, not a certification of
Railway/Vercel capacity or a simulation of 120 physical mobile browsers.
