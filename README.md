# Pendataan Mahasiswa (Temporary README)

> This README is a stopgap document. Replace or expand it once the project documentation is finalized.

## Overview

Pendataan Mahasiswa is a single-page web application that supports the official data collection of Indonesian students in Malaysia. The site guides students through a multi-step form that captures personal details, university affiliations, and PPI (Indonesian Student Association) information in both Bahasa Indonesia and English.

## Key Features

-   Multi-step registration flow with progress indicators and validation hints.
-   Dynamic form controls fed by local JSON datasets for provinces, universities, and postcodes.
-   Internationalization toggle (`ID`/`EN`) backed by `i18n.json` and local storage persistence.
-   Rich, responsive UI powered by Bootstrap 5, custom CSS, and GSAP-driven motion accents.
-   Profile view (`profile.html`) for presenting an individual student's registered data.

## Tech Stack

-   Vanilla HTML, CSS, and JavaScript (ES6 modules avoided for static hosting simplicity).
-   Bootstrap 5 for layout and components.
-   Greensock (GSAP) for animation helpers (`gsap.js`).
-   Local JSON assets for data (`regioncode.json`, `universities.json`, `postcode.json`).

## Getting Started (Local Preview)

1. Clone or download this repository.
2. Serve the folder with any static HTTP server, for example:
    ```bash
    npx serve .
    ```
    or use VS Code's Live Server extension / Python's `python -m http.server`.
3. Open `http://localhost:3000` (or whatever port your server reports) to view the site.

> Opening the HTML files directly from the filesystem will block `fetch()` calls for the JSON data. Always use a local web server during development.

## Project Structure Highlights

-   `index.html`: Landing page + multi-step registration form.
-   `profile.html`: Static profile template rendered after submission (placeholder implementation).
-   `main.js`: Core client logic (form flow, data hydration, i18n, storage helpers).
-   `main.css`: Custom styling and layout for both desktop and mobile.
-   `i18n.json`: Copy deck for Bahasa Indonesia and English translations.
-   `regioncode.json`, `postcode.json`, `universities.json`: Reference datasets used in the form.
-   `image/`: Assets for branding and backgrounds.

## Internationalization Notes

-   UI language is stored under `localStorage.lang`; defaults to Bahasa Indonesia (`ID`).
-   Update or add languages by editing `i18n.json` and including matching `data-i18n` keys in HTML.
-   The language switch UI is in `index.html` (`#langSwitch`) and wired in `main.js` via `I18nManager.bindSwitch`.

## Data & Form Flow

1. **Basic information**: Captures mandatory personal data.
2. **Additional information**: Optional personal details.
3. **University information**: Pulls institution list from `universities.json` with fallback messaging.
4. **PPI (University level)** and **PPI Malaysia**: Captures organizational affiliations.

Form state is managed client-side; submission endpoints are not yet wired. Adapt `main.js` to integrate with your backend or third-party form service.

## Roadmap / TODO

-   Hook the form submission to a real backend or serverless endpoint.
-   Add validation feedback and error handling for all fields.
-   Document JSON schema expectations for easier data updates.
-   Write automated tests (e.g., Cypress, Playwright) for the form flow.
-   Replace this temporary README with stakeholder-approved documentation.

## Contributing

1. Fork the project and create a feature branch.
2. Make your changes and ensure the static site still loads without console errors.
3. Submit a pull request describing the modifications and any manual testing performed.

## License

This project is released under the terms of the [MIT License](LICENSE).
