# Learning Agent Academy

A browser-based spy runner for primary school lessons, built with plain HTML, CSS, and JavaScript.

For art direction, gameplay tuning, and rebuild notes, see [GRAPHICS-REGENERATION.md](/home/mike/Documents/Games/Nathan/GRAPHICS-REGENERATION.md).

## Run It

```bash
cd /home/mike/Documents/Games/Nathan
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/
```

## Publish On GitHub Pages

This project is already set up for GitHub Pages with the workflow in [.github/workflows/deploy-pages.yml](/home/mike/Documents/Games/Nathan/.github/workflows/deploy-pages.yml).

1. Create a new GitHub repository.
2. Push this folder to the `main` branch.
3. In GitHub, open `Settings` -> `Pages`.
4. Set `Source` to `GitHub Actions`.
5. The site will publish automatically on each push to `main`.

If you want to do that from the terminal:

```bash
cd /home/mike/Documents/Games/Nathan
git init
git add .
git commit -m "Initial Learning Agent Academy site"
gh repo create learning-agent-academy --public --source=. --remote=origin --push
```

Then in the new GitHub repo:

```text
Settings -> Pages -> Source: GitHub Actions
```

GitHub will give you a URL like:

```text
https://YOUR-USERNAME.github.io/learning-agent-academy/
```

Notes:
- The game saves progress in browser `localStorage`, so progress stays on each device/browser separately.
- Voice depends on the browser speech engine, so it can sound different on Chrome, Edge, Safari, and tablets.
- The site is static, so there is no backend server bill for this version.

## Controls

- `Space`, `Arrow Up`, or `W`: jump
- `Arrow Down` or `S`: duck
- `Enter`: quick-start the selected mission from the menu
- `M` or `Escape`: leave the current run and return to menu
- `R`: restart the current mission after a failure

On touch devices there are `Jump` and `Duck` buttons.

## What’s In This Build

- one spy-corridor world
- slower pacing and fewer, easier laser obstacles
- a clear final approach into each lesson door, with no lasers right beside it
- traps can still sit close to the vault door, with only a very small final gap
- four selectable agents in suits:
  - Agent N
  - Agent M
  - Agent Mum
  - Agent Dad
- three-life mission structure with ninja capture after the third obstacle hit
- multiple debrief endings, including different ninja-capture outcomes
- door-unlock lesson questions for:
  - spelling
  - grammar
  - punctuation
  - maths
  - science
  - history
  - geography
  - DT
  - computing
  - Spanish
  - French
- learning-inspired security puzzles:
  - code keypad
  - wire console
  - keycard reader
  - power reroute panel
- vault-style lesson doors for the challenge screens
- year group selectors from `Year 1` to `Year 13`, plus `Adult Mode`
- practice mode that weights toward weaker question history
- browser speech playback when the lock screen opens
- red alarm failure state if a final-life lock is answered incorrectly
- local save data in browser `localStorage`

## Useful Test URLs

- Main menu:

```text
http://127.0.0.1:8765/
```

- Auto-start the currently selected mission:

```text
http://127.0.0.1:8765/?autostart=1
```

- Auto-start practice mode:

```text
http://127.0.0.1:8765/?autostart=1&practice=1
```

- Auto-start a specific subject and year:

```text
http://127.0.0.1:8765/?autostart=1&subject=history&year=year-2
```

- Force-open the challenge overlay after auto-start:

```text
http://127.0.0.1:8765/?autostart=1&challenge=1&subject=history&year=year-2
```

- Disable voice for testing:

```text
http://127.0.0.1:8765/?voice=off
```

- Reset saved progress once:

```text
http://127.0.0.1:8765/?reset=1
```

## Notes

- The visuals are procedural canvas art, not imported sprite sheets.
- The current look is faux-3D / 2.5D spy art, not mesh-based 3D.
- If speech playback is unavailable in a browser, the lesson lock still works with typed answers.
