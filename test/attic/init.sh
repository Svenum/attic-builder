#!/bin/sh

# Create Database file
touch /attic/server.db

atticd -f /attic/server.toml
