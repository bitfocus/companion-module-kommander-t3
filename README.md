# companion-module-kommander-t3

See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE)

## Getting started

The module is plain JavaScript (Node 22), with no compile step. Run `yarn` to install the dependencies, then:

- `yarn test`: run the tests, which play Kommander's side with the messages Kommander 360 8.2 sends and accepts.
- `yarn format`: format the code with Prettier.
- `yarn check`: run Bitfocus' module checks.
- `yarn build`: build the package that Companion loads (`kommander-t3-<version>.tgz`).

To try it in Companion, put this folder in Companion's developer modules folder (set in the launcher's settings). Companion reloads the module when a file changes.

## Files

- `main.js`: connection to Kommander and its state.
- `actions.js`, `feedbacks.js`, `presets.js`, `variables.js`: what the module offers in Companion. Buttons store the ids and options of actions and feedbacks, so those must not change; when they have to, add an upgrade script to `upgrade.js`.
- `tests/`: the tests, with stand-ins for `@companion-module/base` and `ws`.

## Kommander's protocol

Kommander listens on port 1702 for WebSocket messages like `{"KommanderMsg": "KommanderMsg_<name>", "params": {...}}`, after a login (`KommanderMsg_Authentication`). It answers with the same name and a `code` (1 is success), and it also sends notices when its state changes. It sends no state on connection, so the module asks for it once the media library is in. The tests in `tests/module.test.js` show the messages the module uses.
