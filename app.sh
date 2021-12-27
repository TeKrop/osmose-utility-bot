#!/bin/bash

# Navigate into the osmose utility bot directory
cd /opt/osmose-utility-bot

# Update Slash commands on the guild
node deploy-commands.js

# Launch the bot server
nodemon index.js