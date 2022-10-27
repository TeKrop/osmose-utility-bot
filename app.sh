#!/bin/sh

# Navigate into the osmose utility bot directory
cd /code

# Update Slash commands on the guild
node deploy-commands.js

# Launch the bot server
nodemon index.js