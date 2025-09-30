(() => {
    const core = window.AppCore;
    if (!core) {
        console.error("AppCore is missing");
        return;
    }

    const {
        VisualEnforcer,
        RegionCodesService,
        UniversitiesService,
        PostcodesService,
        I18nManager,
        PhonePrefixSelector,
        UniversityAutocomplete,
    } = core;

    if (
        !VisualEnforcer ||
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
            this.visuals = new VisualEnforcer();
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
        }

        async start() {
            this.visuals.apply();
            await this.setupI18n();
            await this.initPhoneSelectors();
            await this.initPostcodeAutocomplete();
            await this.initUniversityAutocomplete();
            this.initPpiCampusToggle();
            this.initPpiMalaysiaToggle();
            this.bindRegisterStep1Check();
            this.bindLoginForm();
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
            this.i18n.apply(this.i18n.lang);
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
                });
                await selector.init();
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
                    });
                    await autocomplete.init();
                }
            );
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
                    if (result?.success) {
                        this.persistAuthResult(result);
                        if (result.student) {
                            window.location.href = "profile.html";
                            return;
                        }
                    }
                } catch (error) {
                    console.error("Login failed", error);
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
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

        validateRegistrationStep1(data) {
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
                alert(`Please complete: ${missing.join(", ")}`);
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
