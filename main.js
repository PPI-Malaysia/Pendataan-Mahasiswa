// i18n + phone prefix OOP refactor
(() => {
    // ----- Motion (kept for parity; extend as needed) -----
    class Motion {
        constructor(mediaQuery = "(prefers-reduced-motion: reduce)") {
            this.mql = window.matchMedia(mediaQuery);
        }
        isReduced() {
            return this.mql.matches;
        }
    }

    // ----- DOM utilities -----
    const $ = (sel, root = document) => root.querySelector(sel);

    // ----- Visual enforcement (half-tone filter, flood color) -----
    class VisualEnforcer {
        constructor({
            bgImgId = "bg-img",
            floodId = "floodHd",
            filterUrl = "url(#half-tone-hd)",
            floodColor = "#b0003a",
        } = {}) {
            this.bg = document.getElementById(bgImgId);
            this.flood = document.getElementById(floodId);
            this.filterUrl = filterUrl;
            this.floodColor = floodColor;
        }
        apply() {
            if (this.bg) this.bg.style.filter = this.filterUrl;
            if (this.flood)
                this.flood.setAttribute("flood-color", this.floodColor);
        }
    }

    // ----- Fetch JSON -----
    async function fetchJSON(url, { noCache = false } = {}) {
        const opts = {};
        if (noCache) opts.cache = "no-cache";
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`${url} ${res.status}`);
        return res.json();
    }

    // ----- Region codes service (memoized) -----
    class RegionCodesService {
        constructor(url = "regioncode.json") {
            this.url = url;
            this._cache = null;
        }
        async getAll() {
            if (this._cache) return this._cache;
            try {
                const data = await fetchJSON(this.url);
                this._cache = Array.isArray(data) ? data : [];
            } catch (e) {
                console.warn("Can't load region codes :(", e);
                this._cache = [];
            }
            return this._cache;
        }
    }

    // ----- Universities service (memoized) -----
    class UniversitiesService {
        constructor(url = "universities.json") {
            this.url = url;
            this._cache = null;
        }
        async getAll() {
            if (this._cache) return this._cache;
            try {
                const data = await fetchJSON(this.url, { noCache: true });
                this._cache = Array.isArray(data) ? data : [];
            } catch (e) {
                console.warn("Can't load universities :(", e);
                this._cache = [];
            }
            return this._cache;
        }
    }

    // ----- Postcodes service (memoized) -----
    class PostcodesService {
        constructor(url = "postcode.json") {
            this.url = url;
            this._cache = null;
        }

        async getAll() {
            if (this._cache) return this._cache;
            try {
                const data = await fetchJSON(this.url, { noCache: true });
                this._cache = Array.isArray(data) ? data : [];
            } catch (e) {
                console.warn("Can't load postcodes :(", e);
                this._cache = [];
            }
            return this._cache;
        }
    }

    // ----- i18n manager -----
    class I18nManager {
        constructor({
            url = "i18n.json",
            storageKey = "lang",
            defaultLang = "ID",
        } = {}) {
            this.url = url;
            this.storageKey = storageKey;
            this.defaultLang = defaultLang;
            this.dicts = null;
            this.lang = this.getSavedLang() || defaultLang;
        }

        getSavedLang() {
            try {
                return localStorage.getItem(this.storageKey);
            } catch {
                return null;
            }
        }

        saveLang(lang) {
            try {
                localStorage.setItem(this.storageKey, lang);
            } catch {}
        }

        async load() {
            if (this.dicts) return this.dicts;
            try {
                this.dicts = await fetchJSON(this.url, { noCache: true });
            } catch (e) {
                console.warn("Can't translate :(", e);
                this.dicts = {};
            }
            return this.dicts;
        }

        apply(lang = this.lang) {
            if (!this.dicts) return;
            const dict = this.dicts[lang] || this.dicts.ID || {};
            document.querySelectorAll("[data-i18n]").forEach((el) => {
                const key = el.getAttribute("data-i18n");
                const value = dict[key];
                if (typeof value === "string") el.textContent = value;
            });
            document.documentElement.setAttribute(
                "lang",
                lang === "EN" ? "en" : "id"
            );
            this.lang = lang;
            this.saveLang(lang);
        }

        bindSwitch(el) {
            if (!el) return;
            const setUI = (lang) => {
                el.dataset.lang = lang;
                el.setAttribute("aria-checked", String(lang === "EN"));
            };

            setUI(this.lang);
            el.addEventListener("click", () => {
                const next = el.dataset.lang === "ID" ? "EN" : "ID";
                setUI(next);
                const evt = new CustomEvent("languagechange", {
                    detail: { lang: next },
                    bubbles: true,
                });
                el.dispatchEvent(evt);
            });

            document.addEventListener("languagechange", (e) => {
                const lang = e.detail?.lang || this.defaultLang;
                this.apply(lang);
                setUI(lang);
            });
        }
    }

    // ----- Phone country prefix dropdown -----
    class PhonePrefixSelector {
        constructor({
            button,
            menu,
            input,
            defaultCode = "+60",
            regionService,
        }) {
            this.button = button;
            this.menu = menu;
            this.input = input;
            this.defaultCode = button?.dataset?.prefix || defaultCode;
            this.regionService = regionService;
        }

        updatePlaceholder(code) {
            const digits = String(code || "").replace("+", "");
            if (this.input) this.input.placeholder = `${digits}**********`;
        }

        updateSelection(code) {
            if (!this.button) return;
            this.button.textContent = code;
            this.button.dataset.prefix = code;
            this.updatePlaceholder(code);
        }

        _makeItem({ code, country }) {
            const li = document.createElement("li");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dropdown-item";
            btn.dataset.prefix = code;
            btn.textContent = `${country} (${code})`;
            btn.addEventListener("click", () => {
                this.updateSelection(code);
                if (window.bootstrap?.Dropdown) {
                    const dd = bootstrap.Dropdown.getOrCreateInstance(
                        this.button
                    );
                    dd.hide();
                }
                this.button.focus();
            });
            li.append(btn);
            return li;
        }

        async init() {
            if (!this.button || !this.menu || !this.input) return;
            const codes = await this.regionService.getAll();
            if (!Array.isArray(codes) || codes.length === 0) {
                this.updateSelection(this.defaultCode);
                return;
            }

            this.menu.innerHTML = "";
            const frag = document.createDocumentFragment();
            for (const row of codes) {
                if (!row?.code || !row?.country) continue;
                frag.append(this._makeItem(row));
            }
            this.menu.append(frag);
            this.updateSelection(this.defaultCode);
        }
    }

    // ----- University autocomplete (badge single-select) -----
    class UniversityAutocomplete {
        constructor({
            input,
            menu,
            pill,
            pillLabel,
            clearBtn,
            hiddenInput,
            universityService,
            dataService,
            minChars = 2,
            maxItems = 8,
            itemLabel,
            itemValue,
            fallbackItem,
            filterFn,
            optionPrefix = "typeahead-option",
        }) {
            this.input = input;
            this.menu = menu;
            this.pill = pill;
            this.pillLabel = pillLabel;
            this.clearBtn = clearBtn;
            this.hiddenInput = hiddenInput;
            this.dataService = universityService || dataService || null;
            this.minChars = minChars;
            this.maxItems = maxItems;
            this.all = null;
            this.visible = [];
            this.activeIndex = -1;
            this.hasSelection = false;
            this.placeholder = input?.getAttribute("placeholder") || "";
            this.optionIdSeed = 0;
            this.documentClickHandler = this.handleDocumentClick.bind(this);
            this.control = input?.closest(".liquid-typeahead-control");
            const defaultFallback = {
                university_id: "108",
                university_name: "Other University",
            };
            this.itemLabel =
                typeof itemLabel === "function"
                    ? itemLabel
                    : (item) => item?.university_name || "";
            this.itemValue =
                typeof itemValue === "function"
                    ? itemValue
                    : (item) => item?.university_id || "";
            this.fallbackItem =
                fallbackItem === undefined ? defaultFallback : fallbackItem;
            this.filterFn = typeof filterFn === "function" ? filterFn : null;
            this.optionPrefix = optionPrefix || "typeahead-option";
        }

        async ensureData() {
            if (this.all) return this.all;
            if (!this.dataService?.getAll) {
                this.all = [];
                return this.all;
            }
            this.all = await this.dataService.getAll();
            return this.all;
        }

        filter(term) {
            if (this.filterFn) {
                const result = this.filterFn(term, this.all || []);
                return Array.isArray(result) ? result : [];
            }
            const lower = term.toLowerCase();
            return (this.all || []).filter((item) => {
                const label = this.itemLabel(item) || "";
                return label.toLowerCase().includes(lower);
            });
        }

        showMenu() {
            if (!this.menu || this.hasSelection || this.visible.length === 0)
                return;
            this.menu.classList.add("show");
            this.input.setAttribute("aria-expanded", "true");
        }

        hideMenu() {
            if (!this.menu) return;
            this.menu.classList.remove("show");
            this.input.setAttribute("aria-expanded", "false");
            this.input.removeAttribute("aria-activedescendant");
            this.activeIndex = -1;
        }

        setActive(index) {
            this.activeIndex = index;
            const buttons = Array.from(
                this.menu.querySelectorAll("button[data-id]")
            );
            buttons.forEach((btn, idx) => {
                const isActive = idx === index;
                btn.classList.toggle("active", isActive);
                btn.setAttribute("aria-selected", String(isActive));
                if (isActive) {
                    this.input.setAttribute("aria-activedescendant", btn.id);
                    btn.scrollIntoView({ block: "nearest" });
                }
            });
            if (index < 0) this.input.removeAttribute("aria-activedescendant");
        }

        buildMenu(items = []) {
            this.menu.innerHTML = "";
            const fragment = document.createDocumentFragment();
            const source = Array.isArray(items) ? [...items] : [];

            if (source.length === 0 && this.fallbackItem) {
                source.push(this.fallbackItem);
            }

            let appended = 0;
            const appendedItems = [];
            source.forEach((item) => {
                const label = this.itemLabel(item) || "";
                if (!label) return;
                const valueRaw = this.itemValue(item);
                const value =
                    valueRaw !== undefined && valueRaw !== null
                        ? String(valueRaw)
                        : label;
                const li = document.createElement("li");
                const btn = document.createElement("button");
                const optionId = `${this.optionPrefix}-${this.optionIdSeed++}`;
                btn.type = "button";
                btn.className = "dropdown-item";
                btn.id = optionId;
                btn.role = "option";
                btn.dataset.id = value;
                btn.dataset.name = label;
                btn.textContent = label;
                btn.addEventListener("mousedown", (evt) =>
                    evt.preventDefault()
                );
                btn.addEventListener("click", () => {
                    this.select(btn.dataset);
                });
                li.append(btn);
                fragment.append(li);
                appended += 1;
                appendedItems.push(item);
            });

            if (appended === 0) {
                this.visible = [];
                this.hideMenu();
                return;
            }

            this.visible = appendedItems;
            this.menu.append(fragment);
            this.menu.setAttribute("role", "listbox");
            this.setActive(-1);
            this.showMenu();
            this.menu.scrollTop = 0;
        }

        async handleInput() {
            if (this.hasSelection) return;
            const term = this.input.value.trim();
            if (term.length < this.minChars) {
                this.visible = [];
                this.hideMenu();
                this.menu.innerHTML = "";
                return;
            }

            await this.ensureData();
            const matches = this.filter(term).slice(0, this.maxItems);
            this.buildMenu(matches);
        }

        handleFocus() {
            if (this.hasSelection) return;
            if (this.input.value.trim().length >= this.minChars) {
                this.handleInput();
            }
        }

        handleKeydown(event) {
            if (this.hasSelection) return;
            const buttons = Array.from(
                this.menu.querySelectorAll("button[data-id]")
            );
            if (buttons.length === 0) return;

            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    this.showMenu();
                    this.setActive(
                        this.activeIndex + 1 >= buttons.length
                            ? 0
                            : this.activeIndex + 1
                    );
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    this.showMenu();
                    this.setActive(
                        this.activeIndex <= 0
                            ? buttons.length - 1
                            : this.activeIndex - 1
                    );
                    break;
                case "Enter":
                    if (this.activeIndex >= 0) {
                        event.preventDefault();
                        buttons[this.activeIndex].click();
                    }
                    break;
                case "Escape":
                    this.hideMenu();
                    break;
                default:
                    break;
            }
        }

        select({ id, name }) {
            const label = name || "";
            this.hasSelection = true;
            this.hideMenu();
            this.visible = [];
            this.menu.innerHTML = "";
            if (this.hiddenInput) this.hiddenInput.value = id || label;
            if (this.pillLabel) this.pillLabel.textContent = label;
            if (this.pill) this.pill.hidden = false;
            if (this.clearBtn) this.clearBtn.hidden = false;
            if (this.control) this.control.classList.add("is-locked");
            this.input.value = "";
            this.input.setAttribute("readonly", "true");
            this.input.setAttribute("aria-readonly", "true");
            this.input.setAttribute("placeholder", "");
            this.input.blur();
            if (this.clearBtn) {
                requestAnimationFrame(() => this.clearBtn.focus());
            }
            //update all uni_name class
            const uniNameEls = document.querySelectorAll(".uni_name");
            uniNameEls.forEach((el) => {
                el.textContent = label;
            });
        }

        clearSelection() {
            this.hasSelection = false;
            if (this.hiddenInput) this.hiddenInput.value = "";
            if (this.pill) this.pill.hidden = true;
            if (this.clearBtn) this.clearBtn.hidden = true;
            this.input.removeAttribute("readonly");
            this.input.removeAttribute("aria-readonly");
            this.input.setAttribute("placeholder", this.placeholder);
            this.hideMenu();
            this.visible = [];
            this.menu.innerHTML = "";
            if (this.control) this.control.classList.remove("is-locked");
            this.input.focus();
        }

        handleDocumentClick(evt) {
            if (
                !this.menu.contains(evt.target) &&
                evt.target !== this.input &&
                evt.target !== this.clearBtn &&
                !(this.control && this.control.contains(evt.target))
            ) {
                this.hideMenu();
            }
        }

        bindEvents() {
            this.input.addEventListener("focus", () => this.handleFocus());
            this.input.addEventListener("input", () => this.handleInput());
            this.input.addEventListener("keydown", (evt) =>
                this.handleKeydown(evt)
            );

            this.input.addEventListener("blur", () => {
                setTimeout(() => {
                    if (!this.menu.contains(document.activeElement)) {
                        this.hideMenu();
                    }
                }, 100);
            });

            this.menu.addEventListener("mousedown", (evt) => {
                if (evt.target.closest("button")) evt.preventDefault();
            });

            if (this.clearBtn) {
                this.clearBtn.addEventListener("click", () => {
                    this.clearSelection();
                });
            }

            document.addEventListener("click", this.documentClickHandler);
        }

        async init() {
            if (!this.input || !this.menu) return;
            if (this.pill) this.pill.hidden = true;
            if (this.clearBtn) this.clearBtn.hidden = true;
            this.bindEvents();
            this.input.setAttribute("aria-expanded", "false");
        }
    }

    // ----- App glue -----
    class App {
        constructor() {
            this.motion = new Motion();
            this.visuals = new VisualEnforcer();
            this.i18n = new I18nManager();
            this.regionSvc = new RegionCodesService();
            this.universitySvc = new UniversitiesService();
            this.postcodeSvc = new PostcodesService();
        }

        async start() {
            this.visuals.apply();

            // i18n
            await this.i18n.load();
            this.i18n.apply(this.i18n.lang);
            this.i18n.bindSwitch(document.getElementById("langSwitch"));

            // phone prefixes
            const phoneGroups = Array.from(
                document.querySelectorAll(".js-phone-group")
            );
            for (const [index, group] of phoneGroups.entries()) {
                const button = group.querySelector(".js-phone-prefix");
                const menu = group.querySelector(".js-phone-menu");
                const input = group.querySelector(".js-phone-input");
                if (!button || !menu || !input) continue;

                const uid = `phone-${index + 1}`;
                button.id = `${uid}-button`;
                menu.id = `${uid}-menu`;
                menu.setAttribute("aria-labelledby", button.id);

                const selector = new PhonePrefixSelector({
                    button,
                    menu,
                    input,
                    regionService: this.regionSvc,
                });
                await selector.init();
            }

            // postcode autocomplete
            const postcodeGroups = Array.from(
                document.querySelectorAll(".js-postcode-group")
            );
            for (const [index, group] of postcodeGroups.entries()) {
                const input = group.querySelector(".js-postcode-input");
                const menu = group.querySelector(".js-postcode-menu");
                if (!input || !menu) continue;

                const pill = group.querySelector(".js-postcode-pill");
                const pillLabel = group.querySelector(
                    ".js-postcode-pill-label"
                );
                const clearBtn = group.querySelector(".js-postcode-clear");
                const hiddenInput = group.querySelector(".js-postcode-value");

                const uid = `postcode-${index + 1}`;
                input.id = `${uid}-input`;
                menu.id = `${uid}-menu`;
                input.setAttribute("aria-controls", menu.id);
                input.setAttribute("aria-owns", menu.id);
                menu.setAttribute("aria-labelledby", input.id);

                const formatLabel = (row) => {
                    if (!row) return "";
                    const zip = row.zip_code;
                    const zipStr =
                        zip !== undefined && zip !== null
                            ? String(zip).trim()
                            : "";
                    const city = row.city ? String(row.city).trim() : "";
                    const state = row.state_name
                        ? String(row.state_name).trim()
                        : "";
                    const location = [city, state].filter(Boolean).join(", ");
                    return [zipStr, location].filter(Boolean).join(" - ");
                };

                const filterPostcodes = (term, rows) => {
                    const lower = term.trim().toLowerCase();
                    if (!lower) return [];
                    return rows.filter((row) =>
                        formatLabel(row).toLowerCase().includes(lower)
                    );
                };

                const postcodeAutocomplete = new UniversityAutocomplete({
                    input,
                    menu,
                    pill,
                    pillLabel,
                    clearBtn,
                    hiddenInput,
                    dataService: this.postcodeSvc,
                    minChars: 1,
                    itemLabel: formatLabel,
                    itemValue: (row) =>
                        row?.zip_code !== undefined && row?.zip_code !== null
                            ? String(row.zip_code)
                            : "",
                    fallbackItem: null,
                    filterFn: filterPostcodes,
                    optionPrefix: "postcode-option",
                    maxItems: 10,
                });
                await postcodeAutocomplete.init();
            }

            // universities autocomplete
            const universityGroups = Array.from(
                document.querySelectorAll(".js-university-group")
            );
            for (const [index, group] of universityGroups.entries()) {
                const input = group.querySelector(".js-university-input");
                const menu = group.querySelector(".js-university-menu");
                if (!input || !menu) continue;

                const pill = group.querySelector(".js-university-pill");
                const pillLabel = group.querySelector(
                    ".js-university-pill-label"
                );
                const clearBtn = group.querySelector(".js-university-clear");
                const hiddenInput = group.querySelector(".js-university-value");

                const uid = `university-${index + 1}`;
                input.id = `${uid}-input`;
                menu.id = `${uid}-menu`;
                input.setAttribute("aria-controls", menu.id);
                input.setAttribute("aria-owns", menu.id);
                menu.setAttribute("aria-labelledby", input.id);

                const autocomplete = new UniversityAutocomplete({
                    input,
                    menu,
                    pill,
                    pillLabel,
                    clearBtn,
                    hiddenInput,
                    universityService: this.universitySvc,
                });
                await autocomplete.init();
            }

            // PPI campus membership details toggle
            const ppiDetails = document.getElementById("ppiCampusDetails");
            const ppiRadios = Array.from(
                document.querySelectorAll("input[name='ppiCampusMember']")
            );
            if (ppiDetails && ppiRadios.length) {
                const setDisabled = (disabled) => {
                    ppiDetails.classList.toggle("is-disabled", disabled);
                    ppiDetails.setAttribute("aria-disabled", String(disabled));
                    const fields = ppiDetails.querySelectorAll(
                        "input, textarea, select, button"
                    );
                    fields.forEach((field) => {
                        field.disabled = disabled;
                    });
                };

                const syncDetails = () => {
                    const enable = document.getElementById("ppiCampusYes")?.checked;
                    setDisabled(!enable);
                };

                ppiRadios.forEach((radio) => {
                    radio.addEventListener("change", syncDetails);
                });

                syncDetails();
            }

            const ppiMalaysiaDetails = document.getElementById(
                "ppiMalaysiaDetails"
            );
            const ppiMalaysiaRadios = Array.from(
                document.querySelectorAll("input[name='ppiMalaysiaMember']")
            );
            if (ppiMalaysiaDetails && ppiMalaysiaRadios.length) {
                const setMalaysiaDisabled = (disabled) => {
                    ppiMalaysiaDetails.classList.toggle(
                        "is-disabled",
                        disabled
                    );
                    ppiMalaysiaDetails.setAttribute(
                        "aria-disabled",
                        String(disabled)
                    );
                    const fields = ppiMalaysiaDetails.querySelectorAll(
                        "input, textarea, select, button"
                    );
                    fields.forEach((field) => {
                        field.disabled = disabled;
                    });
                };

                const syncMalaysiaDetails = () => {
                    const enable = document.getElementById("ppiMalaysiaYes")?.checked;
                    setMalaysiaDisabled(!enable);
                };

                ppiMalaysiaRadios.forEach((radio) => {
                    radio.addEventListener("change", syncMalaysiaDetails);
                });

                syncMalaysiaDetails();
            }
        }
    }

    // ----- Boot -----
    document.addEventListener("DOMContentLoaded", () => {
        new App().start();
    });
})();
