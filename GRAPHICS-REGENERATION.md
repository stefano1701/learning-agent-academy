# Spy Mission Graphics Regeneration Guide

This build now targets a single spy-mission world with procedural canvas art. No OpenAI API key is required for the current version.

## Current Goal

Keep the game feeling:

- grounded rather than toy-like
- readable for a child while moving
- spy themed without copying another game or film exactly
- faux-3D / 2.5D, not flat
- easy to iterate without a full external art pipeline

The current direction is:

- one realistic-feeling black-site corridor
- metal panels, monitors, vault door, warning lights, and floor reflections
- easy red laser obstacles instead of random crates and props
- a visible vault-style lesson door during challenge screens
- a tiny final gap before each lesson door so lasers can still sit close to the vault
- two selectable child agents
- softer 3D-cartoon facial proportions with larger eyes and rounded cheeks
- Nathan: blonde short ponytail, blue eyes, freckles, suit
- Matthew: brown short hair, suit, softer younger face
- no shop, no boards, no skins, no chaser
- red flashing alarm state for final-life lesson failure
- challenge overlays with a visible sealed security door
- challenge overlays with a front-facing vault-style steel door
- learning-inspired puzzle panels instead of a plain single input every time

## Files That Control The Look

- [src/game.js](/home/mike/Documents/Games/Nathan/src/game.js)
- [src/styles.css](/home/mike/Documents/Games/Nathan/src/styles.css)
- [index.html](/home/mike/Documents/Games/Nathan/index.html)

Important drawing functions in `src/game.js`:

- `drawBackground(...)`
- `drawMonitor(...)`
- `drawLaserBeam(...)`
- `drawAgent(...)`
- `drawNinja(...)`
- `drawLaserObstacle(...)`
- `drawRunScene(...)`
- `drawMenuScene(...)`
- `drawSceneVignette(...)`

## Gameplay Tuning Knobs

If the run needs more slowing down, speeding up, or more or fewer obstacles, change these values in [src/game.js](/home/mike/Documents/Games/Nathan/src/game.js):

- `createRun(...)`
  - `speed`
  - `maxSpeed`
  - `acceleration`
  - `nextChallengeAt`
- `updateRun(...)`
  - obstacle timer reset range
  - distance multiplier `run.distance += ...`
  - jump velocity and gravity
- `createLaserObstacle(...)`
  - beam widths
  - low-vs-high laser weighting
- `getObstacleRect(...)`
  - hitbox generosity

## Voice Behaviour

Speech uses browser-native `speechSynthesis`.

Relevant functions:

- `openChallenge(...)`
- `renderChallengePuzzle(...)`
- `setDoorState(...)`
- `speakCurrentChallenge(...)`

Current behaviour:

- the word or prompt is spoken immediately when the lock screen opens
- `Replay Briefing` repeats the current spoken prompt
- `Voice: On/Off` toggles speech globally
- challenges can appear as a keypad, wire console, keycard reader, or power reroute panel

## Alarm And Failure Behaviour

Relevant functions:

- `handleChallengeSubmit(...)`
- `handleChallengeContinue(...)`
- `finishRun(...)`

Current rules:

- wrong answer with more than one life left:
  - show the correct answer
  - wait for click to continue
- wrong answer on the last life:
  - red flashing alarm state
  - worried face on the lock card
  - click through to the game-over debrief
- third obstacle hit:
  - short ninja capture sequence
  - fail the run
- debrief text varies by ending severity, especially for ninja captures

## Character Art Rules

If you redraw the agent later, keep these non-negotiables:

- male spy silhouette
- soft-featured CG-cartoon proportions, not a flat stick-figure look
- short blonde ponytail, not long hair
- blue visible eye
- freckles on the cheek
- dark suit with white shirt and tie
- no skateboard, hoverboard, backpack, or cap

The current look is slightly stylised, but the proportions are less chunky than the older cartoony runner.

## Environment Art Rules

Keep these scene anchors:

- dark steel corridor
- control monitors built into wall columns
- sealed vault door in the background
- a chunky learning-door panel on the challenge overlay
- glossy floor with reflected light strips
- red laser security beams
- warm gold highlights and cool blue monitor light

Avoid:

- outdoor city scenes
- multiple worlds
- collectible clutter
- graffiti walls
- bright toy props
- copied branded mission-impossible-style iconography

## If You Want To Regenerate The Graphics Later

Use this order:

1. Keep the lesson system and three-life mission logic.
2. Preserve the same silhouette for the agent.
3. Rebuild the corridor background first.
4. Replace the laser obstacle pass next.
5. Replace the agent and ninja drawings after the environment reads well.
6. Re-test hitbox clarity before adding extra visual detail.

## Optional Future AI Asset Workflow

If you want to use an OpenAI API key later, use it to create source art offline, not live in gameplay.

Recommended approach:

1. Generate a concept sheet for the corridor, the agent, and the ninja.
2. Approve one art direction before making production assets.
3. Export transparent PNGs or sprite sheets into an `assets/` folder.
4. Replace procedural drawing one layer at a time.

Prompt direction that fits this build:

- child-friendly spy mission game
- sleek black-site corridor
- steel walls and red security lasers
- one male agent in a fitted suit
- blonde short ponytail
- blue eyes and freckles
- readable at small size
- cinematic but not gritty

Avoid prompt direction like:

- horror
- hyper-real skin detail
- military realism
- copied branded character likenesses
- cluttered neon arcade scenes

## Rebuild Checklist

If someone needs to recreate the current style from scratch:

1. Build the rounded-rect, shading, and glow helpers first.
2. Draw the corridor shell with columns, monitors, and the vault door.
3. Add the floor reflections and hazard-strip movement.
4. Draw low and high laser obstacles with generous hitboxes.
5. Draw the agent in a suit with the blonde ponytail and freckles.
6. Add the ninja silhouette capture pass.
7. Add the challenge-card door overlay, puzzle panels, and alarm state in CSS.
8. Test on desktop and mobile before polishing small details.

## Non-Negotiables

- keep the run slower and less crowded than before
- keep the obstacles easy to read
- keep the lock screen clear and immediate
- keep the world count at one
- keep the player loadout to one agent only
- do not let visual polish make the lasers harder than the gameplay
