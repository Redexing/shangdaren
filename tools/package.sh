#!/bin/bash

# Define the name of the output zip file
ZIP_NAME="shangdaren_game_pwa.zip"

echo "Creating PWA package: $ZIP_NAME..."

# Remove old package if it exists
if [ -f "$ZIP_NAME" ]; then
    rm "$ZIP_NAME"
fi

# Create the zip file
# Exclude:
# - All .md files
# - test.js and test_get_actions.js
# - The tools directory itself
# - Hidden files (like .git, .DS_Store)
zip -r "$ZIP_NAME" . \
    -x "*.md" \
    -x "test.js" \
    -x "test_get_actions.js" \
    -x "test_harmony.js" \
    -x "tools/*" \
    -x ".git/*" \
    -x ".gitignore" \
    -x ".gemini/*" \
    -x ".DS_Store" \
    -x "package-lock.json" \
    -x "node_modules/*"

echo "Package successfully created at: $(pwd)/$ZIP_NAME"
