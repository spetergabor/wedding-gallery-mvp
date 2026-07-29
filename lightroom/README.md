# Spetly Lightroom Classic plugin

This folder contains the first minimal Lightroom Classic export plugin skeleton.

## Install for testing

1. Open Lightroom Classic.
2. Go to `File > Plug-in Manager`.
3. Click `Add`.
4. Select `/Users/mac/SPETER - gallery app/lightroom/Spetly.lrplugin`.
5. Export photos and choose `Spetly` as the export service.
6. Optional: turn on `Save rendered files locally too` and choose a folder if you also want a local copy.

## Required values

- `Base URL`: usually `https://spetly.app`.
- `Gallery token`: generated in Spetly under the gallery `Settings > Lightroom Classic` block.

## Current scope

- Tests the gallery token.
- Creates a Spetly upload session.
- Uploads rendered export files to the R2 presigned URLs.
- Optionally saves the same rendered files into a local folder.
- Completes the session so the files appear in the gallery.

This is intentionally still a small v0.1 plugin. The next step is a real-world Lightroom test and then tightening error handling/resume behavior.
