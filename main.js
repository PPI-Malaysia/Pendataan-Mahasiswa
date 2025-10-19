(() => {
    const core = window.AppCore;
    if (!core) {
        console.error("AppCore is missing");
        return;
    }
    const {
        RegionCodesService,
        UniversitiesService,
        PostcodesService,
        I18nManager,
        PhonePrefixSelector,
        UniversityAutocomplete,
    } = core;

    if (
        !RegionCodesService ||
        !UniversitiesService ||
        !PostcodesService ||
        !I18nManager ||
        !PhonePrefixSelector ||
        !UniversityAutocomplete
    ) {
        console.error("AppCore is incomplete");
        return;
    }

    class App {
        constructor() {
            this.i18n = new I18nManager();
            this.regionSvc = new RegionCodesService();
            this.universitySvc = new UniversitiesService();
            this.postcodeSvc = new PostcodesService();
            this.token = localStorage.getItem("token");
            this.api = new StudentAPI({ token: this.token });
            this.existingStudentModal = null;
            this.existingStudentModalFields = null;
            this.pendingExistingResult = null;
            this.pendingExistingDecision = null;
            this.uniNameEls = Array.from(
                document.querySelectorAll(".uni_name")
            );
            this.uniNameDefaults = this.uniNameEls.map(
                (el) => el?.textContent || ""
            );
            this.stepGuardUpdates = new Map();
            this.loginFailedModal = null;
        }

        async start() {
            await this.setupI18n();
            await this.initPhoneSelectors();
            await this.initPostcodeAutocomplete();
            await this.initUniversityAutocomplete();
            this.initPpiCampusToggle();
            this.initPpiMalaysiaToggle();
            this.initStepGuards();
            this.bindRegisterStep1Check();
            this.bindLoginForm();
            this.bindCompleteRegister();
        }

        async forEachGroup(selector, handler) {
            const groups = document.querySelectorAll(selector);
            let index = 0;
            for (const group of groups) {
                // allow handler to opt out early by returning false
                const result = await handler(group, index);
                if (result === false) break;
                index += 1;
            }
        }

        async setupI18n() {
            await this.i18n.load();
            // A little adjustment to handle the new structure in i18n.json
            const applyTranslations = (lang) => {
                const dict = this.i18n.dicts[lang] || this.i18n.dicts.ID || {};
                const aboutDict =
                    this.i18n.dicts["about-page"]?.[lang] ||
                    this.i18n.dicts["about-page"]?.ID ||
                    {};
                const combined = { ...dict, ...aboutDict };
                document.querySelectorAll("[data-i18n]").forEach((el) => {
                    const key = el.getAttribute("data-i18n");
                    const value = combined[key];
                    if (typeof value === "string") el.innerHTML = value;
                });
            };
            this.i18n.apply = applyTranslations; // Override the original apply
            this.i18n.apply(this.i18n.lang); // Apply for the first time
            this.i18n.bindSwitch(document.getElementById("langSwitch"));
        }

        async initPhoneSelectors() {
            await this.forEachGroup(".js-phone-group", async (group, index) => {
                const button = group.querySelector(".js-phone-prefix");
                const menu = group.querySelector(".js-phone-menu");
                const input = group.querySelector(".js-phone-input");
                if (!button || !menu || !input) return;

                const uid = `phone-${index + 1}`;
                button.id = `${uid}-button`;
                menu.id = `${uid}-menu`;
                menu.setAttribute("aria-labelledby", button.id);

                const selector = new PhonePrefixSelector({
                    button,
                    menu,
                    input,
                    regionService: this.regionSvc,
                    onSelect: () => {
                        if (group.closest("#register1")) {
                            this.triggerStepGuardUpdate("gotoRegister2");
                        } else if (group.closest("#register2")) {
                            this.triggerStepGuardUpdate("gotoRegister3");
                        } else if (group.closest("#register3")) {
                            this.triggerStepGuardUpdate("gotoRegister4");
                        }
                    },
                });
                await selector.init();
                if (group.closest("#register1")) {
                    this.triggerStepGuardUpdate("gotoRegister2");
                }
            });
        }

        async initPostcodeAutocomplete() {
            const formatLabel = (row) => {
                if (!row) return "";
                const zip = row.zip_code;
                const zipStr =
                    zip !== undefined && zip !== null ? String(zip).trim() : "";
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
            await this.forEachGroup(
                ".js-postcode-group",
                async (group, index) => {
                    const input = group.querySelector(".js-postcode-input");
                    const menu = group.querySelector(".js-postcode-menu");
                    if (!input || !menu) return;

                    const pill = group.querySelector(".js-postcode-pill");
                    const pillLabel = group.querySelector(
                        ".js-postcode-pill-label"
                    );
                    const clearBtn = group.querySelector(".js-postcode-clear");
                    const hiddenInput =
                        group.querySelector(".js-postcode-value");

                    const uid = `postcode-${index + 1}`;
                    input.id = `${uid}-input`;
                    menu.id = `${uid}-menu`;
                    input.setAttribute("aria-controls", menu.id);
                    input.setAttribute("aria-owns", menu.id);
                    menu.setAttribute("aria-labelledby", input.id);

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
                            row?.zip_code !== undefined &&
                            row?.zip_code !== null
                                ? String(row.zip_code)
                                : "",
                        fallbackItem: null,
                        filterFn: filterPostcodes,
                        optionPrefix: "postcode-option",
                        maxItems: 10,
                        onSelect: () =>
                            this.triggerStepGuardUpdate("gotoRegister3"),
                        onClear: () =>
                            this.triggerStepGuardUpdate("gotoRegister3"),
                    });
                    await postcodeAutocomplete.init();
                }
            );
        }

        async initUniversityAutocomplete() {
            await this.forEachGroup(
                ".js-university-group",
                async (group, index) => {
                    const input = group.querySelector(".js-university-input");
                    const menu = group.querySelector(".js-university-menu");
                    if (!input || !menu) return;

                    const pill = group.querySelector(".js-university-pill");
                    const pillLabel = group.querySelector(
                        ".js-university-pill-label"
                    );
                    const clearBtn = group.querySelector(
                        ".js-university-clear"
                    );
                    const hiddenInput = group.querySelector(
                        ".js-university-value"
                    );

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
                        onSelect: ({ label }) => {
                            this.setUniversityGreeting(label);
                            if (group.closest("#register1")) {
                                this.triggerStepGuardUpdate("gotoRegister2");
                            }
                        },
                        onClear: () => {
                            this.resetUniversityGreeting();
                            if (group.closest("#register1")) {
                                this.triggerStepGuardUpdate("gotoRegister2");
                            }
                        },
                    });
                    await autocomplete.init();
                }
            );
        }

        ensureLoginFailedModal() {
            if (this.loginFailedModal) return this.loginFailedModal;

            const modalEl = document.getElementById("loginFailedModal");
            if (!modalEl) {
                console.warn("loginFailedModal element is missing");
                this.loginFailedModal = { el: null, instance: null };
                return this.loginFailedModal;
            }

            const messageEl = modalEl.querySelector(
                "[data-role='login-failed-message']"
            );
            const ModalCtor = window.bootstrap?.Modal;
            const instance = ModalCtor
                ? ModalCtor.getOrCreateInstance(modalEl, {
                      backdrop: "static",
                      keyboard: true,
                  })
                : null;

            this.loginFailedModal = { el: modalEl, instance };
            return this.loginFailedModal;
        }

        showLoginFailedModal(message) {
            const modal = this.ensureLoginFailedModal();

            if (modal?.instance) {
                modal.instance.show();
            } else {
                window.alert(
                    message ||
                        "We couldn't find a matching student. Please check your details or create a new registration."
                );
            }
        }

        setUniversityGreeting(name = "") {
            if (!this.uniNameEls?.length) return;
            const label = typeof name === "string" ? name.trim() : "";
            this.uniNameEls.forEach((el, idx) => {
                const fallback = this.uniNameDefaults?.[idx] || "";
                el.textContent = label || fallback;
            });
        }

        resetUniversityGreeting() {
            if (!this.uniNameEls?.length) return;
            this.uniNameEls.forEach((el, idx) => {
                const fallback = this.uniNameDefaults?.[idx] || "";
                el.textContent = fallback;
            });
        }

        initPpiCampusToggle() {
            const details = document.getElementById("ppiCampusDetails");
            const radios = Array.from(
                document.querySelectorAll("input[name='ppiCampusMember']")
            );
            if (!details || !radios.length) return;

            const setDisabled = (disabled) => {
                details.classList.toggle("is-disabled", disabled);
                details.setAttribute("aria-disabled", String(disabled));
                const fields = details.querySelectorAll(
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

            radios.forEach((radio) => {
                radio.addEventListener("change", syncDetails);
            });

            syncDetails();
        }

        initPpiMalaysiaToggle() {
            const details = document.getElementById("ppiMalaysiaDetails");
            const radios = Array.from(
                document.querySelectorAll("input[name='ppiMalaysiaMember']")
            );
            if (!details || !radios.length) return;

            const setDisabled = (disabled) => {
                details.classList.toggle("is-disabled", disabled);
                details.setAttribute("aria-disabled", String(disabled));
                const fields = details.querySelectorAll(
                    "input, textarea, select, button"
                );
                fields.forEach((field) => {
                    field.disabled = disabled;
                });
            };

            const syncDetails = () => {
                const enable =
                    document.getElementById("ppiMalaysiaYes")?.checked;
                setDisabled(!enable);
            };

            radios.forEach((radio) => {
                radio.addEventListener("change", syncDetails);
            });

            syncDetails();
        }

        initStepGuards() {
            const guards = [
                {
                    stepId: "register1",
                    buttonId: "gotoRegister2",
                    collectValues: () => this.collectRegisterStep1Values(),
                    isComplete: (data) => this.isRegisterStep1Complete(data),
                    selectors: [
                        "#register-fullname",
                        "#register-dob",
                        "#register-passport",
                        "#register-phone",
                        ".js-phone-input",
                        ".js-university-input",
                        {
                            selector: ".js-university-value",
                            events: ["change"],
                        },
                        { selector: ".js-university-clear", events: ["click"] },
                    ],
                    onInit: ({ container, update }) => {
                        const phoneMenu =
                            container.querySelector(".js-phone-menu");
                        if (phoneMenu) {
                            phoneMenu.addEventListener("click", update);
                        }
                    },
                },
                {
                    stepId: "register2",
                    buttonId: "gotoRegister3",
                    collectValues: () => this.collectRegisterStep2Values(),
                    isComplete: (data) => this.isRegisterStep2Complete(data),
                    selectors: [
                        "input[type='email']",
                        "textarea",
                        ".js-postcode-input",
                        { selector: ".js-postcode-value", events: ["change"] },
                        { selector: ".js-postcode-clear", events: ["click"] },
                    ],
                },
                {
                    stepId: "register3",
                    buttonId: "gotoRegister4",
                    collectValues: () => this.collectRegisterStep3Values(),
                    isComplete: (data) => this.isRegisterStep3Complete(data),
                    selectors: [
                        "select",
                        "input[type='text']",
                        "input[type='date']",
                    ],
                },
            ];

            guards.forEach((guard) => this.registerStepGuard(guard));
        }

        registerStepGuard({
            stepId,
            buttonId,
            collectValues,
            isComplete,
            selectors = [],
            onInit,
        }) {
            const button = document.getElementById(buttonId);
            const container = document.getElementById(stepId);
            if (!button || !container) return;

            const update = () => {
                const data =
                    typeof collectValues === "function"
                        ? collectValues()
                        : null;
                const complete =
                    typeof isComplete === "function"
                        ? Boolean(isComplete(data))
                        : false;
                button.disabled = !complete;
                return complete;
            };

            button.disabled = true;

            const elementBindings = new WeakMap();
            const attach = (el, events) => {
                if (!el) return;
                const seen = elementBindings.get(el) || new Set();
                events.forEach((evt) => {
                    if (seen.has(evt)) return;
                    el.addEventListener(evt, update);
                    seen.add(evt);
                });
                elementBindings.set(el, seen);
            };

            selectors.forEach((entry) => {
                const detail =
                    typeof entry === "string"
                        ? { selector: entry, events: ["input", "change"] }
                        : entry;
                const { selector, events = ["input", "change"] } = detail || {};
                if (!selector) return;
                container
                    .querySelectorAll(selector)
                    .forEach((el) => attach(el, events));
            });

            if (typeof onInit === "function") {
                try {
                    onInit({ container, button, update });
                } catch (error) {
                    console.error("Step guard onInit failed", error);
                }
            }

            this.stepGuardUpdates.set(buttonId, { update, button, container });
            update();
        }

        triggerStepGuardUpdate(buttonId) {
            if (!buttonId) return;
            const guard = this.stepGuardUpdates?.get(buttonId);
            if (!guard) return;
            guard.update();
        }

        bindRegisterStep1Check() {
            const trigger = document.getElementById("gotoRegister2");
            if (trigger) {
                trigger.addEventListener("click", (event) =>
                    this.handleRegisterStep1Next(event)
                );
            }
        }

        bindLoginForm() {
            const form = document.getElementById("loginform");
            if (!form) return;

            form.addEventListener("submit", async (event) => {
                event.preventDefault();

                const submitBtn = form.querySelector("button[type='submit']");
                if (submitBtn) submitBtn.disabled = true;

                const fullnameInput = form.elements.namedItem("login-fullname");
                const dobInput = form.elements.namedItem("login-dob");
                const passportInput = form.elements.namedItem("login-passport");
                const phoneInput = form.elements.namedItem("login-phone");
                const phonePrefixBtn = phoneInput
                    ?.closest(".js-phone-group")
                    ?.querySelector(".js-phone-prefix");
                const universityHidden =
                    form.elements.namedItem("login-university");
                const universityNameInput = form.elements.namedItem(
                    "login-university_name"
                );
                const universityNameEl = form.querySelector(
                    ".js-university-pill-label"
                );

                const toTrimmed = (el) =>
                    typeof el?.value === "string" ? el.value.trim() : "";

                const phoneNumber = (() => {
                    if (!phoneInput) return "";
                    const digits = phoneInput.value.replace(/\s+/g, "").trim();
                    if (!digits) return "";
                    const prefix =
                        phonePrefixBtn?.dataset?.prefix ||
                        phonePrefixBtn?.textContent?.trim() ||
                        "";
                    return `${prefix}${digits}`;
                })();

                const universityName = (
                    toTrimmed(universityNameInput) ||
                    universityNameEl?.textContent ||
                    ""
                ).trim();

                const payload = {
                    fullname: toTrimmed(fullnameInput),
                    dob: toTrimmed(dobInput),
                    passport: toTrimmed(passportInput),
                    phone_number: phoneNumber,
                    university_id: toTrimmed(universityHidden),
                    university: universityName,
                };

                try {
                    const result = await this.api.check(payload);
                    if (result?.success && result.student) {
                        this.persistAuthResult(result);
                        if (result.student) {
                            window.location.href = "profile.html";
                            return;
                        }
                    }
                    this.showLoginFailedModal();
                } catch (error) {
                    console.error("Login failed", error);
                    this.showLoginFailedModal(
                        "Student information not found. Please double-check your information or create a new registration."
                    );
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        bindCompleteRegister() {
            const button = document.getElementById("completeRegister");
            if (!button) return;

            button.addEventListener("click", (event) =>
                this.handleCompleteRegister(event)
            );
        }

        async handleCompleteRegister(event) {
            const trigger = event?.currentTarget;
            if (trigger) trigger.disabled = true;

            const payload = this.collectAllRegistrationValues();
            console.log("Registration payload:", payload);
            console.log(
                "Registration payload (JSON):",
                JSON.stringify(payload, null, 2)
            );

            try {
                const result = await this.api.add(payload);
                console.log("Registration add result:", result);
                if (result?.success) {
                    this.persistAuthResult(result);
                    console.info("Registration saved successfully");
                    window.location.href = "profile.html";
                    return;
                }
            } catch (error) {
                console.error("Registration submission failed", error);
            } finally {
                if (trigger) trigger.disabled = false;
            }
        }

        persistAuthResult(result = {}) {
            if (!result || typeof result !== "object") return;
            if (result.token) {
                localStorage.setItem("token", result.token);
                this.token = result.token;
                this.api.setToken(result.token);
            }

            if (result.student) {
                try {
                    sessionStorage.setItem(
                        "student",
                        JSON.stringify(result.student)
                    );
                } catch (storageError) {
                    console.warn(
                        "Unable to persist student in sessionStorage",
                        storageError
                    );
                }
            }
        }

        collectRegisterStep1Values() {
            const container = document.getElementById("register1");
            if (!container) return null;

            const trimValue = (el) =>
                typeof el?.value === "string" ? el.value.trim() : "";

            const fullnameInput = container.querySelector("#register-fullname");
            const dobInput = container.querySelector("#register-dob");
            const passportInput = container.querySelector("#register-passport");
            const phoneInput = container.querySelector("#register-phone");
            const phonePrefixBtn = container.querySelector(".js-phone-prefix");
            const universityHidden = container.querySelector(
                ".js-university-value"
            );
            const universityNameEl = container.querySelector(
                ".js-university-pill-label"
            );
            const universityInput = container.querySelector(
                ".js-university-input"
            );

            const phoneDigits = phoneInput
                ? phoneInput.value.replace(/\s+/g, "").trim()
                : "";
            const prefix =
                phonePrefixBtn?.dataset?.prefix ||
                phonePrefixBtn?.textContent?.trim() ||
                "";

            return {
                fullname: trimValue(fullnameInput),
                dob: trimValue(dobInput),
                passport: trimValue(passportInput),
                phone_number: phoneDigits ? `${prefix}${phoneDigits}` : "",
                university_id: trimValue(universityHidden),
                university: (
                    trimValue(universityInput) ||
                    universityNameEl?.textContent ||
                    ""
                ).trim(),
            };
        }

        isRegisterStep1Complete(data) {
            return this.validateRegistrationStep1(data, { silent: true });
        }

        collectRegisterStep2Values() {
            const container = document.getElementById("register2");
            if (!container) return null;

            const trimValue = (el) =>
                typeof el?.value === "string" ? el.value.trim() : "";

            const emailInput = container.querySelector("input[type='email']");
            const addressInput = container.querySelector("textarea");
            const postcodeHidden =
                container.querySelector(".js-postcode-value");

            return {
                email: trimValue(emailInput),
                address: trimValue(addressInput),
                postcode: trimValue(postcodeHidden),
            };
        }

        isRegisterStep2Complete(data) {
            if (!data) return false;
            const baseComplete = ["email", "address", "postcode"].every((key) =>
                Boolean(data[key])
            );
            if (!baseComplete) return false;

            const email = (data.email || "").trim();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailPattern.test(email);
        }

        collectRegisterStep3Values() {
            const container = document.getElementById("register3");
            if (!container) return null;

            const trimValue = (el) =>
                typeof el?.value === "string" ? el.value.trim() : "";

            const levelSelect = container.querySelector("select");
            const programmeInput =
                container.querySelector("input[type='text']");
            const graduationInput =
                container.querySelector("input[type='date']");

            return {
                level: trimValue(levelSelect),
                programme: trimValue(programmeInput),
                graduation: trimValue(graduationInput),
            };
        }

        isRegisterStep3Complete(data) {
            if (!data) return false;
            const keys = ["level", "programme", "graduation"];
            return keys.every((key) => Boolean(data[key]));
        }

        collectRegisterStep4Values() {
            const container = document.getElementById("register4");
            if (!container) return null;

            const trimValue = (el) =>
                typeof el?.value === "string" ? el.value.trim() : "";

            const membership = container.querySelector(
                "input[name='ppiCampusMember']:checked"
            )?.value;

            const details = container.querySelector("#ppiCampusDetails");
            const inputs = details
                ? Array.from(details.querySelectorAll("input"))
                : [];
            const textarea = details?.querySelector("textarea");
            if (membership == "no") {
                return {};
            }
            return {
                membership,
                startYear: trimValue(inputs[0]),
                endYear: trimValue(inputs[1]),
                department: trimValue(inputs[2]),
                position: trimValue(inputs[3]),
                additionalInfo: trimValue(textarea),
            };
        }

        collectRegisterStep5Values() {
            const container = document.getElementById("register5");
            if (!container) return null;

            const trimValue = (el) =>
                typeof el?.value === "string" ? el.value.trim() : "";

            const membership = container.querySelector(
                "input[name='ppiMalaysiaMember']:checked"
            )?.value;

            const details = container.querySelector("#ppiMalaysiaDetails");
            const inputs = details
                ? Array.from(details.querySelectorAll("input"))
                : [];
            const textarea = details?.querySelector("textarea");

            if (membership == "no") {
                return {};
            }

            return {
                membership,
                startYear: trimValue(inputs[0]),
                endYear: trimValue(inputs[1]),
                department: trimValue(inputs[2]),
                position: trimValue(inputs[3]),
                additionalInfo: trimValue(textarea),
            };
        }

        collectAllRegistrationValues() {
            const personal = this.collectRegisterStep1Values() || {};
            const contact = this.collectRegisterStep2Values() || {};
            const education = this.collectRegisterStep3Values() || {};
            const ppiCampus = this.collectRegisterStep4Values() || {};
            const ppiMalaysia = this.collectRegisterStep5Values() || {};

            return {
                fullname: personal.fullname || "",
                dob: personal.dob || "",
                passport: personal.passport || "",
                phone_number: personal.phone_number || "",
                university: personal.university || "",
                university_id: this.coerceNumeric(personal.university_id),
                email: contact.email || "",
                address: contact.address || "",
                postcode: contact.postcode || "",
                education_level: education.level || "",
                education_programme: education.programme || "",
                education_graduation: education.graduation || "",
                ppi_campus: ppiCampus,
                ppim: ppiMalaysia,
            };
        }

        coerceNumeric(value) {
            if (value === undefined || value === null) return "";
            const trimmed =
                typeof value === "string" ? value.trim() : String(value);
            if (!trimmed) return "";
            const numeric = Number(trimmed);
            return Number.isFinite(numeric) ? numeric : trimmed;
        }

        validateRegistrationStep1(data, { silent = false } = {}) {
            if (!data) return false;
            const required = [
                ["fullname", "Full Name"],
                ["dob", "Date of Birth"],
                ["passport", "Passport Number"],
                ["phone_number", "Phone Number"],
                ["university_id", "University"],
            ];
            const missing = required
                .filter(([key]) => !data[key])
                .map(([, label]) => label);
            if (missing.length) {
                if (!silent) {
                    alert(`Please complete: ${missing.join(", ")}`);
                }
                return false;
            }

            const passport = data.passport
                ? data.passport.trim().toUpperCase()
                : "";
            data.passport = passport;
            const passportPattern = /^[A-Z][0-9]{7}$/; // 1 letter + 7 digits (e.g., A1234567)
            if (!passportPattern.test(passport)) {
                if (!silent) {
                    alert(
                        "Nomor paspor tidak valid. Gunakan format huruf kapital diikuti 7 digit, mis. A1234567."
                    );
                    const input = document.getElementById("register-passport");
                    if (input) input.value = passport;
                }
                return false;
            }

            return true;
        }

        goToRegisterStepTwo() {
            const args = [
                "#register1",
                "#register2",
                "#register2-progress",
                "#barspan1",
                "#barspan2",
            ];
            const isDesktop = window.matchMedia("(min-width: 992px)").matches;
            const advanceFn = isDesktop
                ? window.regist_next
                : window.regist_next_m;
            if (typeof advanceFn === "function") {
                advanceFn(...args);
                return;
            }

            const current = document.querySelector(args[0]);
            const next = document.querySelector(args[1]);
            if (current && next) {
                current.style.display = "none";
                next.style.display = "block";
            }
        }

        async handleRegisterStep1Next(event) {
            if (event) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            const trigger = event?.currentTarget;
            if (trigger) trigger.disabled = true;

            try {
                const payload = this.collectRegisterStep1Values();
                if (!payload) {
                    this.goToRegisterStepTwo();
                    return;
                }

                if (!this.validateRegistrationStep1(payload)) return;

                let result = null;
                try {
                    result = await this.api.check(payload);
                } catch (error) {
                    console.error("Registration check failed", error);
                    this.goToRegisterStepTwo();
                    return;
                }

                if (result?.success && result.student) {
                    this.showExistingStudentModal(result.student, result);
                    return;
                }

                this.goToRegisterStepTwo();
            } finally {
                if (trigger) trigger.disabled = false;
                if (trigger?.id) {
                    this.triggerStepGuardUpdate(trigger.id);
                }
            }
        }

        ensureExistingStudentModal() {
            if (this.existingStudentModal) return this.existingStudentModal;

            const modal = document.getElementById("existingStudentModal");
            if (!modal) {
                console.warn("existingStudentModal element is missing");
                this.existingStudentModal = { el: null, instance: null };
                return this.existingStudentModal;
            }

            modal.addEventListener("click", (event) => {
                const trigger = event.target.closest("[data-action]");
                if (!trigger) return;
                event.preventDefault();
                const action = trigger.getAttribute("data-action");
                if (action === "not-me") {
                    this.handleExistingStudentDecision("notMe");
                } else if (action === "is-me") {
                    this.handleExistingStudentDecision("isMe");
                }
            });

            modal.addEventListener("hidden.bs.modal", () => {
                const decision = this.pendingExistingDecision;
                this.pendingExistingDecision = null;

                if (decision === "isMe") {
                    if (this.pendingExistingResult) {
                        this.persistAuthResult(this.pendingExistingResult);
                        window.location.href = "profile.html";
                    }
                } else {
                    this.goToRegisterStepTwo();
                }

                this.pendingExistingResult = null;
            });

            const ModalCtor = window.bootstrap?.Modal;
            const instance = ModalCtor
                ? ModalCtor.getOrCreateInstance?.(modal, {
                      backdrop: "static",
                      keyboard: false,
                  }) ||
                  new ModalCtor(modal, { backdrop: "static", keyboard: false })
                : null;

            this.existingStudentModalFields = {
                fullname: modal.querySelector("[data-field='fullname']"),
                dob: modal.querySelector("[data-field='dob']"),
                passport: modal.querySelector("[data-field='passport']"),
                phone: modal.querySelector("[data-field='phone']"),
                university: modal.querySelector("[data-field='university']"),
                email: modal.querySelector("[data-field='email']"),
            };

            this.existingStudentModal = { el: modal, instance };
            return this.existingStudentModal;
        }

        populateExistingStudentModal(student = {}) {
            if (!this.existingStudentModalFields) return;
            const fields = this.existingStudentModalFields;
            const fallback = "-";
            const safe = (value) => {
                if (value === undefined || value === null) return fallback;
                const str = String(value).trim();
                return str || fallback;
            };

            if (fields.fullname)
                fields.fullname.textContent = safe(student.fullname);
            if (fields.dob) fields.dob.textContent = safe(student.dob);
            if (fields.passport)
                fields.passport.textContent = safe(student.passport);
            const phoneValue =
                student.phone ||
                student.phone_number ||
                student.phoneNumber ||
                "";
            if (fields.phone) fields.phone.textContent = safe(phoneValue);
            if (fields.university)
                fields.university.textContent = safe(student.university);
            if (fields.email) fields.email.textContent = safe(student.email);
        }

        showExistingStudentModal(student = {}, result = null) {
            this.pendingExistingResult = result;
            this.pendingExistingDecision = null;

            const modal = this.ensureExistingStudentModal();
            this.populateExistingStudentModal(student);

            if (modal?.instance) {
                modal.instance.show();
                return;
            }

            const lines = [
                "It looks like your information exist.",
                "",
                `Full Name: ${student.fullname || "-"}`,
                `Date of Birth: ${student.dob || "-"}`,
                `Passport: ${student.passport || "-"}`,
                `Phone: ${
                    student.phone ||
                    student.phone_number ||
                    student.phoneNumber ||
                    "-"
                }`,
                `University: ${student.university || "-"}`,
                `Email: ${student.email || "-"}`,
                "",
                "Continue with this registration?",
            ];
            const confirmed = window.confirm(lines.join("\n"));
            if (confirmed) {
                if (result) {
                    this.persistAuthResult(result);
                    window.location.href = "profile.html";
                }
            } else {
                this.goToRegisterStepTwo();
            }
            this.pendingExistingResult = null;
        }

        handleExistingStudentDecision(decision) {
            this.pendingExistingDecision = decision;
            const modal =
                this.existingStudentModal || this.ensureExistingStudentModal();
            if (modal?.instance) {
                modal.instance.hide();
                return;
            }

            if (decision === "isMe") {
                if (this.pendingExistingResult) {
                    this.persistAuthResult(this.pendingExistingResult);
                    window.location.href = "profile.html";
                }
            } else {
                this.goToRegisterStepTwo();
            }
            this.pendingExistingResult = null;
            this.pendingExistingDecision = null;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        new App().start();
    });
})();
