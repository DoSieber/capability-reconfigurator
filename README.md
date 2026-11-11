# Capability Reconfiguration

Workshop tool for sorting customer service tasks into inside and outside the frontier of AI, then assigning knowledge, skills and abilities to each zone.

## Files

- `library.json` holds all content: `tasks`, `knowledge`, `skills`, `abilities`, and the worked `example`. Edit this file to change what appears in the library.
- `index.html` is the page markup.
- `style.css` holds the styles.
- `app.js` holds the logic.

## Editing the library

Each list in `library.json` is a plain list of strings. Add, rename or remove entries and reload the page. The `example` block refers to entries by their exact text, so update it when you rename an item.

Items that participants add in the app are stored in their browser only. They survive edits to `library.json`. Renaming an item in `library.json` removes it from any zone where it was placed.

## Running locally

The page loads `library.json` with `fetch`, which browsers block for pages opened directly from disk. Start a local server in the project folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.
