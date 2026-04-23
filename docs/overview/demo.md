# Demo

## Screenshot / demo image

![Nottermost demo placeholder](../assets/demo.svg)

This is currently a placeholder image checked into the repo so the docs site renders consistently.

## How to create a real screenshot

1. Start the stack:
   - `docker compose up --build`
2. Use two browser profiles:
   - register user A and user B
3. As user A:
   - create a workspace
   - add user B by email
   - create a channel and send a message with a reaction
   - open a DM and send a message (verify realtime)
4. Take screenshots of:
   - workspace shell with channel list + DM list
   - channel page with a thread rail open
   - DM page with typing indicator or presence

When you have a real screenshot, replace `docs/assets/demo.svg` with a real image (e.g. `docs/assets/demo.png`) and update references.
