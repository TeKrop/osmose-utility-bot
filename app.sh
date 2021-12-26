#!/bin/bash

# Update Slash commands on the guild
node deploy-commands.js

# Launch the bot server
nodemon index.js