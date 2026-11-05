# Rngdlez

A Chrome extension that adds quick-roll and automatic score-target rolling controls to [rngdle.com](https://www.rngdle.com).

## Features

- **Roll** — generates a new number using the game's controls.
- **Clear** — clears the current roll and resets the game.
- **Auto** — keeps rolling until the selected minimum score is reached.
- The target score and Auto setting are saved in extension storage.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the project folder.
5. Open or refresh [rngdle.com](https://www.rngdle.com).

## Use

Use **Roll** to generate a number, **Clear** to reset, or turn on **Auto** and enter a positive minimum score before rolling. The game’s own Generate control remains available.

## Permissions

The extension runs on `www.rngdle.com` and uses local extension storage to remember its settings and roll state.
