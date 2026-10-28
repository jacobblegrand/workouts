# Workout tracker

Minimal mobile-first Angular tracker for the supplied A/B dumbbell routine.

Run `npm install`, then `npm start`. Open http://localhost:4200.
Run `npm run build` for production files in `dist/workout/browser`.
Run `node --test tests/storage.test.cjs` for storage checks.

## Local SQLite storage

SQLite runs in the browser through sql.js WebAssembly. The binary SQLite file is persisted in IndexedDB (`workout-sqlite`, store `files`, key `workouts.sqlite`). There is no backend or external database service. The WASM asset ships with the app.

History and the active draft migrate automatically from the previous `forma-v1` localStorage key on first use. The original is retained as a migration backup; new saves go to SQLite. Writes are serialized and only reported successful after the IndexedDB transaction commits. A failed save preserves the active entries.

History → Download SQLite backup exports an ordinary `.sqlite` file. Browser-managed storage is specific to this site's origin, browser profile, and device. Clearing site data deletes it; changing port or host uses a different database. Persistent storage is requested where supported, but backups are still useful. Data does not sync between devices. This is not a file automatically written into the project folder.

## Logging

Enter working weight, actual reps per set, and optional last-set RPE. Save advances the A/B rotation. Partial workouts are supported. The last logged weight for each exercise carries forward; new reps and RPE remain blank. RPE is omitted for pushups and reverse crunches per the sheet.

Weights are per dumbbell where applicable. The unit selector labels the current entries; it does not convert values already typed. Carry-forward converts a previous session's weight if its recorded unit differs.

## GitHub Pages

The GitHub Actions workflow builds and deploys pushes to main. Enable Pages with GitHub Actions as the publishing source. The Pages build uses /workouts/ as its base path, including the bundled SQLite WASM file. Run npm run build:pages to build it locally.

The deployed site has separate browser storage from localhost. Existing localhost data is not automatically transferred to the deployed origin. No workout database is committed or uploaded.

Choose Workout A or Workout B manually. Each has its own saved draft; switching and reloading preserve both. After saving, the app selects the other type. History entries can be deleted with confirmation. Deletion leaves the current selection and draft unchanged.

Reps are now fixed to the spreadsheet prescriptions and displayed read-only. New workout logs use these targets automatically; only weight and RPE are editable. Older workout history retains its original recorded reps.
