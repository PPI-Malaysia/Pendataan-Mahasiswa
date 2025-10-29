(function () {
    const ugt = localStorage.getItem("ugt");
    const token = localStorage.getItem("token");
    if (!ugt || !token) {
        window.location.href = "index.html";
    }

    const hideLoadingOverlay = () => {
        const loadingOverlay = document.getElementById("loadingOverlay");
        const loadingOverlay2 = document.getElementById("loadingOverlay2");
        const mainContent = document.getElementById("mainContent");

        loadingOverlay.classList.add("hidden");
        loadingOverlay2.classList.add("hidden");

        setTimeout(() => {
            if (mainContent) {
                mainContent.classList.add("visible");
            }
        }, 250);
    };
    let isLoaded = false;
    window.addEventListener("load", function () {
        const checkInterval = setInterval(function () {
            if (isLoaded) {
                hideLoadingOverlay();
                clearInterval(checkInterval);
            }
        }, 1000);
    });

    const api = new StudentAPI({ token: token });
    function refreshTranslations() {
        const lang = localStorage.getItem("lang") || "ID";
        document.dispatchEvent(
            new CustomEvent("languagechange", { detail: { lang } })
        );
    }

    const editPD = document.getElementById("editPersonalDetails");
    const editUD = document.getElementById("editUniversityDetails");
    const addPPI = document.getElementById("addPPICampusRecord");
    const addPPIM = document.getElementById("addPPIMRecord");
    const editModalElement = document.getElementById("editModal");
    let editModalInstance;

    let regionService;
    let postcodeService;
    let universityService;
    let currentStudent = null;
    run();

    function truncateLabel(text, max = 20) {
        if (!text) return "";
        console.log(text);
        return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
    }

    function formatPostcodeLabel(row) {
        if (!row) return "";
        const zip =
            row?.zip_code !== undefined && row?.zip_code !== null
                ? String(row.zip_code).trim()
                : "";
        const city = row?.city ? String(row.city).trim() : "";
        const state = row?.state_name ? String(row.state_name).trim() : "";
        const location = [city, state].filter(Boolean).join(", ");
        const clippedLocation = truncateLabel(location, 22); // tweak length to taste
        return [zip, clippedLocation].filter(Boolean).join(" - ");
    }

    function filterPostcodes(term, rows) {
        const lower = term.trim().toLowerCase();
        if (!lower) return [];
        return rows.filter((row) =>
            formatPostcodeLabel(row).toLowerCase().includes(lower)
        );
    }

    function ensureAppCore() {
        const core = window.AppCore;
        if (!core) {
            console.warn("AppCore is not available");
        }
        return core || null;
    }

    function getRegionService(core) {
        if (!core?.RegionCodesService) return null;
        if (!regionService) {
            regionService = new core.RegionCodesService();
        }
        return regionService;
    }

    function getPostcodeService(core) {
        if (!core?.PostcodesService) return null;
        if (!postcodeService) {
            postcodeService = new core.PostcodesService();
        }
        return postcodeService;
    }

    function getUniversityService(core) {
        if (!core?.UniversitiesService) return null;
        if (!universityService) {
            universityService = new core.UniversitiesService();
        }
        return universityService;
    }

    async function resolveUniversityLabelById(id) {
        if (!id) return "";
        const core = ensureAppCore();
        const svc = getUniversityService(core);
        if (!svc) return "";

        try {
            if (typeof svc.getById === "function") {
                const row = await svc.getById(String(id));
                return row?.name || row?.university || "";
            }
            const rows = (await svc.getAll?.()) || [];
            const m = rows.find(
                (r) => String(r.id ?? r.university_id) === String(id)
            );
            return m?.name || m?.university_name || m?.label || "";
        } catch (e) {
            console.warn("resolveUniversityLabelById failed", e);
            return "";
        }
    }

    async function initPhoneSelectors(root) {
        if (!root) return [];
        const core = ensureAppCore();
        if (!core?.PhonePrefixSelector) return [];
        const regionSvc = getRegionService(core);
        if (!regionSvc) return [];

        const groups = root.querySelectorAll(".js-phone-group");
        if (!groups.length) return [];

        const promises = [];
        groups.forEach((group, index) => {
            const button = group.querySelector(".js-phone-prefix");
            const menu = group.querySelector(".js-phone-menu");
            const input = group.querySelector(".js-phone-input");
            if (!button || !menu || !input) return;

            const uid = `profile-phone-${index + 1}`;
            button.id = `${uid}-button`;
            menu.id = `${uid}-menu`;
            menu.setAttribute("aria-labelledby", button.id);

            const selector = new core.PhonePrefixSelector({
                button,
                menu,
                input,
                regionService: regionSvc,
            });
            const initPromise = selector
                .init()
                .then(() => ({ selector, group, button, menu, input }));
            promises.push(initPromise);
        });

        if (!promises.length) return [];
        const results = await Promise.allSettled(promises);
        const successes = [];
        results.forEach((result) => {
            if (result.status === "fulfilled") {
                successes.push(result.value);
            } else {
                console.error("Phone selector failed to init", result.reason);
            }
        });
        return successes;
    }

    async function initPostcodeAutocomplete(root) {
        if (!root) return [];
        const core = ensureAppCore();
        if (!core?.UniversityAutocomplete) return [];
        const postcodeSvc = getPostcodeService(core);
        if (!postcodeSvc) return [];

        const groups = root.querySelectorAll(".js-postcode-group");
        if (!groups.length) return [];

        const promises = [];
        groups.forEach((group, index) => {
            const input = group.querySelector(".js-postcode-input");
            const menu = group.querySelector(".js-postcode-menu");
            if (!input || !menu) return;

            const pill = group.querySelector(".js-postcode-pill");
            const pillLabel = group.querySelector(".js-postcode-pill-label");
            const clearBtn = group.querySelector(".js-postcode-clear");
            const hiddenInput = group.querySelector(".js-postcode-value");

            const uid = `profile-postcode-${index + 1}`;
            input.id = `${uid}-input`;
            menu.id = `${uid}-menu`;
            input.setAttribute("aria-controls", menu.id);
            input.setAttribute("aria-owns", menu.id);
            menu.setAttribute("aria-labelledby", input.id);

            const autocomplete = new core.UniversityAutocomplete({
                input,
                menu,
                pill,
                pillLabel,
                clearBtn,
                hiddenInput,
                dataService: postcodeSvc,
                minChars: 1,
                maxItems: 10,
                itemLabel: formatPostcodeLabel,
                itemValue: (row) =>
                    row?.zip_code !== undefined && row?.zip_code !== null
                        ? String(row.zip_code)
                        : "",
                fallbackItem: null,
                filterFn: filterPostcodes,
                optionPrefix: `profile-postcode-option-${index + 1}`,
            });
            const initPromise = autocomplete.init().then(() => ({
                autocomplete,
                group,
                input,
                menu,
                pill,
                pillLabel,
                clearBtn,
                hiddenInput,
            }));
            promises.push(initPromise);
        });

        if (!promises.length) return [];
        const results = await Promise.allSettled(promises);
        const successes = [];
        results.forEach((result) => {
            if (result.status === "fulfilled") {
                successes.push(result.value);
            } else {
                console.error(
                    "Postcode autocomplete failed to init",
                    result.reason
                );
            }
        });
        return successes;
    }

    async function initUniversityAutocomplete(root) {
        if (!root) return [];
        const core = ensureAppCore();
        if (!core?.UniversityAutocomplete) return [];
        const universitySvc = getUniversityService(core);
        if (!universitySvc) return [];

        const groups = root.querySelectorAll(".js-university-group");
        if (!groups.length) return [];

        const promises = [];
        groups.forEach((group, index) => {
            const input = group.querySelector(".js-university-input");
            const menu = group.querySelector(".js-university-menu");
            if (!input || !menu) return;

            const pill = group.querySelector(".js-university-pill");
            const pillLabel = group.querySelector(".js-university-pill-label");
            const clearBtn = group.querySelector(".js-university-clear");
            const hiddenInput = group.querySelector(".js-university-value");

            const uid = `profile-university-${index + 1}`;
            input.id = `${uid}-input`;
            menu.id = `${uid}-menu`;
            input.setAttribute("aria-controls", menu.id);
            input.setAttribute("aria-owns", menu.id);
            menu.setAttribute("aria-labelledby", input.id);

            const autocomplete = new core.UniversityAutocomplete({
                input,
                menu,
                pill,
                pillLabel,
                clearBtn,
                hiddenInput,
                universityService: universitySvc,
                optionPrefix: `profile-university-option-${index + 1}`,
            });
            const initPromise = autocomplete.init().then(() => ({
                autocomplete,
                group,
                input,
                menu,
                pill,
                pillLabel,
                clearBtn,
                hiddenInput,
            }));
            promises.push(initPromise);
        });

        if (!promises.length) return [];
        const results = await Promise.allSettled(promises);
        const successes = [];
        results.forEach((result) => {
            if (result.status === "fulfilled") {
                successes.push(result.value);
            } else {
                console.error(
                    "University autocomplete failed to init",
                    result.reason
                );
            }
        });
        return successes;
    }

    async function initPersonalModalFeatures(root) {
        try {
            const [phone, postcode] = await Promise.all([
                initPhoneSelectors(root),
                initPostcodeAutocomplete(root),
            ]);
            return { phone, postcode };
        } catch (error) {
            console.error("Failed to init personal modal features", error);
            return { phone: [], postcode: [] };
        }
    }

    async function initUniversityModalFeatures(root) {
        try {
            const [university] = await Promise.all([
                initUniversityAutocomplete(root),
            ]);
            return { university };
        } catch (error) {
            console.error("Failed to init university modal features", error);
            return { university: [] };
        }
    }

    function applyTypeaheadSelection(feature, { value, label }) {
        if (!feature || value === undefined || value === null) return;
        const { autocomplete, pill, pillLabel, clearBtn, hiddenInput, input } =
            feature;

        const textValue = label || String(value);

        if (hiddenInput) hiddenInput.value = String(value);
        if (pillLabel) pillLabel.textContent = textValue;
        if (pill) pill.hidden = false;
        if (clearBtn) clearBtn.hidden = false;
        if (input) {
            input.value = "";
            input.setAttribute("readonly", "true");
            input.setAttribute("aria-readonly", "true");
            input.setAttribute("placeholder", "");
        }

        if (autocomplete) {
            autocomplete.hasSelection = true;
            if (autocomplete.control) {
                autocomplete.control.classList.add("is-locked");
            }
            if (typeof autocomplete.hideMenu === "function") {
                autocomplete.hideMenu();
            }
        }
    }

    function setPhoneValue(studentPhone, feature, root) {
        if (!studentPhone) return;
        const trimmed = String(studentPhone).trim();
        if (!trimmed) return;
        let prefix = "";
        let remainder = trimmed;

        const detected = trimmed.match(/^(\+\d{1,4})(.*)$/);
        if (detected) {
            prefix = detected[1].trim();
            remainder = detected[2].replace(/\D+/g, "").trim();
        } else {
            remainder = trimmed.replace(/\D+/g, "").trim();
        }

        const input = feature?.input || root?.querySelector(".js-phone-input");
        const button =
            feature?.button || root?.querySelector(".js-phone-prefix");
        const selector = feature?.selector;

        if (
            selector &&
            prefix &&
            typeof selector.updateSelection === "function"
        ) {
            selector.updateSelection(prefix);
        } else if (button && prefix) {
            button.textContent = prefix;
            button.dataset.prefix = prefix;
        }

        if (input) input.value = remainder;
    }

    async function populatePersonalModal(root, featureBag = {}) {
        if (!root) return;
        const student = currentStudent;
        if (!student) return;

        const fullNameInput = root.querySelector("#register-fullname");
        if (fullNameInput) fullNameInput.value = student.fullname || "";

        const dobInput = root.querySelector("#register-dob");
        if (dobInput && student.dob) dobInput.value = student.dob;

        const postcodeFeature = Array.isArray(featureBag.postcode)
            ? featureBag.postcode[0]
            : null;
        const postcodeValue =
            student.postcode_id || student.postcode || student.postcodeId;

        if (postcodeValue) {
            let label = String(postcodeValue);
            if (postcodeFeature) {
                try {
                    const core = ensureAppCore();
                    const svc = getPostcodeService(core);
                    const rows = (await svc?.getAll?.()) || [];
                    const match = rows.find(
                        (row) => String(row?.zip_code) === String(postcodeValue)
                    );
                    if (match) label = formatPostcodeLabel(match);
                } catch (error) {
                    console.error("Unable to resolve postcode label", error);
                }

                applyTypeaheadSelection(postcodeFeature, {
                    value: String(postcodeValue),
                    label,
                });
            } else {
                const postcodeInput = root.querySelector(".js-postcode-input");
                const hiddenInput = root.querySelector(".js-postcode-value");
                if (hiddenInput) hiddenInput.value = String(postcodeValue);
                if (postcodeInput) postcodeInput.value = label;
            }
        }
    }

    function findUniversityFeature(featureBag) {
        if (!featureBag) return null;
        if (Array.isArray(featureBag)) return featureBag[0] || null;
        if (Array.isArray(featureBag.university))
            return featureBag.university[0] || null;
        return null;
    }

    async function populateUniversityModal(root, featureBag = {}) {
        if (!root) return;
        const student = currentStudent;
        if (!student) return;

        const universityFeature = findUniversityFeature(featureBag);
        const universityLabel =
            student.university || student.university_name || "";
        const universityValue =
            student.university_id || student.universityId || universityLabel;

        if (universityLabel) {
            if (universityFeature) {
                applyTypeaheadSelection(universityFeature, {
                    value: String(universityValue),
                    label: universityLabel,
                });
            } else {
                const hiddenInput = root.querySelector(".js-university-value");
                const input = root.querySelector(".js-university-input");
                if (hiddenInput) hiddenInput.value = String(universityValue);
                if (input) input.value = universityLabel;
            }
        }

        const programmeInput = root.querySelector("#register-programme");
        if (programmeInput) {
            programmeInput.value =
                student.degree_programme ||
                student.degree ||
                student.programme ||
                student.program ||
                "";
        }

        const levelSelect = root.querySelector("#register-education-level");
        const levelValue =
            student.level_of_qualification_id ??
            student.education_level_id ??
            student.education_level;
        if (levelSelect && levelValue !== undefined && levelValue !== null) {
            const normalized = String(levelValue).trim();
            if (normalized) levelSelect.value = normalized;
        }

        const graduationInput = root.querySelector(
            "#register-expected-graduation"
        );
        const graduationValue =
            student.expected_graduate ||
            student.expected_graduation ||
            student.graduation_date;
        if (graduationInput && graduationValue) {
            graduationInput.value = graduationValue;
        }
    }

    function bindModalUpdateAction(root, handler) {
        if (!root || typeof handler !== "function") return;
        const updateButton = root.querySelector('[data-action="update"]');
        if (!updateButton) return;
        updateButton.addEventListener("click", (event) => handler(event, root));
    }

    function bindPersonalModalActions(root) {
        bindModalUpdateAction(root, handlePersonalUpdate);
    }

    function bindUniversityModalActions(root) {
        bindModalUpdateAction(root, handleUniversityUpdate);
    }

    function bindPPIModalActions(root) {
        bindModalUpdateAction(root, handlePPIUpdate);
    }

    function bindPPIMModalActions(root) {
        bindModalUpdateAction(root, handlePPIMUpdate);
    }

    function bindPPIMModalUpdateAction(root) {
        bindModalUpdateAction(root, handlePPIMEditUpdate);
    }

    function bindPPICampusModalUpdateAction(root) {
        bindModalUpdateAction(root, handlePPICampusEditUpdate);
    }
    function bindPPIMDeleteAction(root) {
        if (!root) return;
        const deleteButton = root.querySelector(".delete-btn");
        const confirmCheckbox = root.querySelector("#checkDefault");
        if (!deleteButton) return;

        deleteButton.addEventListener("click", async (event) => {
            event.preventDefault();

            if (!confirmCheckbox?.checked) {
                alert("Please tick the confirmation checkbox before deleting.");
                confirmCheckbox?.focus();
                return;
            }

            if (
                !window.confirm(
                    "Delete this PPIM record? This action cannot be undone."
                )
            ) {
                return;
            }

            const recordInput = root.querySelector("#ppim-record-id");
            const recordId =
                (recordInput?.value || "").trim() ||
                deleteButton.dataset.id ||
                "";
            if (!recordId) {
                alert("Unable to determine which record to delete.");
                return;
            }

            const payload = {
                type: "ppim",
                ppim_id: recordId,
                token: api?.token ?? undefined,
            };

            try {
                setButtonBusy(deleteButton, true);
                const result = await api.deletePPI(payload);
                applyStudentUpdate(result);
                if (!result?.student) await callAPI();
                confirmCheckbox.checked = false;
                editModalInstance?.hide?.();
            } catch (error) {
                console.error("Failed to delete PPIM record", error);
                alert(`Unable to delete record: ${error.message}`);
            } finally {
                setButtonBusy(deleteButton, false);
            }
        });
    }

    function bindPPICampusDeleteAction(root) {
        if (!root) return;
        const deleteButton = root.querySelector(".delete-btn");
        const confirmCheckbox = root.querySelector("#checkDefault");
        if (!deleteButton) return;

        deleteButton.addEventListener("click", async (event) => {
            event.preventDefault();

            if (!confirmCheckbox?.checked) {
                alert("Please tick the confirmation checkbox before deleting.");
                confirmCheckbox?.focus();
                return;
            }

            const recordInput = root.querySelector("#ppi-campus-record-id");
            const recordId =
                (recordInput?.value || "").trim() ||
                deleteButton.dataset.id ||
                "";
            if (!recordId) {
                alert("Unable to determine which record to delete.");
                return;
            }

            if (
                !window.confirm(
                    "Delete this PPI campus record? This action cannot be undone."
                )
            ) {
                return;
            }

            const payload = {
                type: "ppi_campus",
                ppi_campus_id: recordId,
                token: api?.token ?? undefined,
            };

            try {
                setButtonBusy(deleteButton, true);
                const result = await api.deletePPI(payload);
                applyStudentUpdate(result);
                if (!result?.student) await callAPI();
                confirmCheckbox.checked = false;
                editModalInstance?.hide?.();
            } catch (error) {
                console.error("Failed to delete PPI campus record", error);
                alert(`Unable to delete record: ${error.message}`);
            } finally {
                setButtonBusy(deleteButton, false);
            }
        });
    }

    function setButtonBusy(button, busy) {
        if (!button) return;
        button.disabled = Boolean(busy);
        if (busy) {
            button.setAttribute("aria-busy", "true");
        } else {
            button.removeAttribute("aria-busy");
        }
    }

    function collectPersonalModalValues(root) {
        if (!root) return null;
        const inputValue = (selector) => {
            const el = root.querySelector(selector);
            return typeof el?.value === "string" ? el.value.trim() : "";
        };

        const fullName = inputValue("#register-fullname");
        const dob = inputValue("#register-dob");

        const passportInput = root.querySelector("#register-passport");
        const passportRaw = inputValue("#register-passport");
        const passport = passportRaw.toUpperCase();
        if (passportInput) passportInput.value = passport;

        const emailInput = root.querySelector("#register-email");
        const emailRaw = inputValue("#register-email");
        const fallbackEmail =
            typeof currentStudent?.email === "string"
                ? currentStudent.email.trim()
                : "";
        const email = emailRaw || fallbackEmail;
        if (emailInput && !emailRaw && fallbackEmail) {
            emailInput.value = fallbackEmail;
        }

        const phoneInput = root.querySelector("#register-phone");
        const prefixButton = root.querySelector(".js-phone-prefix");
        const phoneDigits = phoneInput
            ? phoneInput.value.replace(/\D+/g, "").trim()
            : "";
        const phonePrefix = (
            prefixButton?.dataset?.prefix ||
            prefixButton?.textContent ||
            ""
        )
            .replace(/\s+/g, "")
            .trim();
        const phoneNumber = phoneDigits
            ? `${phonePrefix}${phoneDigits}`.trim()
            : "";

        const postcodeHidden = inputValue(".js-postcode-value");
        const postcodeDisplay = inputValue(".js-postcode-input");
        const postcodeId = postcodeHidden || postcodeDisplay;

        const address = inputValue("#register-address");

        return {
            section: "personal",
            fullname: fullName,
            dob,
            passport,
            email,
            phone_number: phoneNumber,
            phone: phoneNumber,
            postcode: postcodeId,
            postcode_id: postcodeId,
            address,
        };
    }

    function validatePersonalModal(values) {
        if (!values) return false;
        const required = [
            ["fullname", "Full Name"],
            ["dob", "Date of Birth"],
            ["passport", "Passport Number"],
            ["email", "Email"],
            ["phone_number", "Phone Number"],
            ["postcode_id", "Postcode"],
            ["address", "Address"],
        ];

        const missing = required
            .filter(([key]) => !values[key])
            .map(([, label]) => label);

        if (missing.length) {
            alert(`Please complete: ${missing.join(", ")}`);
            return false;
        }

        const passportPattern = /^[A-Z]{1,2}[0-9]{7,8}$/;
        if (!passportPattern.test(values.passport || "")) {
            alert(
                "Invalid Indonesian passport format. Required: 1-2 uppercase letter + 7-9 digits (e.g., A1234567)"
            );
            return false;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(values.email || "")) {
            alert("Email invalid. Please enter a valid email address.");
            return false;
        }
        return true;
    }

    function collectUniversityModalValues(root) {
        if (!root) return null;
        const inputValue = (selector) => {
            const el = root.querySelector(selector);
            return typeof el?.value === "string" ? el.value.trim() : "";
        };

        const hiddenUniversity = inputValue(".js-university-value");
        const pillLabel = root.querySelector(".js-university-pill-label");
        const typedUniversity = inputValue(".js-university-input");
        const universityName = (
            pillLabel?.textContent ||
            typedUniversity ||
            ""
        ).trim();

        const programme = inputValue("#register-programme");
        const level = inputValue("#register-education-level");
        const graduation = inputValue("#register-expected-graduation");

        return {
            section: "university",
            university_id: hiddenUniversity || "",
            university: universityName,
            education_programme: programme,
            programme,
            degree: programme,
            level_of_qualification_id: level,
            education_level: level,
            level,
            education_graduation: graduation,
            expected_graduate: graduation,
        };
    }

    function collectPPIModalValues(root) {
        if (!root) return null;
        const inputValue = (selector) => {
            const el = root.querySelector(selector);
            return typeof el?.value === "string" ? el.value.trim() : "";
        };

        const hiddenUniversity = inputValue(".js-university-value");
        const pillLabel = root.querySelector(".js-university-pill-label");
        const typedUniversity = inputValue(".js-university-input");
        const universityName = (
            pillLabel?.textContent ||
            typedUniversity ||
            ""
        ).trim();
        const department = inputValue("#ppi-department");
        const position = inputValue("#ppi-position");
        const startYear = inputValue("#ppi-start-year");
        const endYear = inputValue("#ppi-end-year");
        const addInfo = inputValue("#ppi-add-info");

        return {
            type: "ppi_campus",
            university_id: hiddenUniversity || "",
            university: universityName,
            department: department,
            position: position,
            start_year: startYear,
            end_year: endYear,
            description: addInfo,
        };
    }

    function collectPPIMModalValues(root) {
        if (!root) return null;
        const inputValue = (selector) => {
            const el = root.querySelector(selector);
            return typeof el?.value === "string" ? el.value.trim() : "";
        };
        const department = inputValue("#ppi-department");
        const position = inputValue("#ppi-position");
        const startYear = inputValue("#ppi-start-year");
        const endYear = inputValue("#ppi-end-year");
        const addInfo = inputValue("#ppi-add-info");

        return {
            type: "ppim",
            department: department,
            position: position,
            start_year: startYear,
            end_year: endYear,
            description: addInfo,
        };
    }

    function collectPPICampusModalUpdateValues(root) {
        if (!root) return null;
        const inputValue = (selector) => {
            const el = root.querySelector(selector);
            return typeof el?.value === "string" ? el.value.trim() : "";
        };

        const submitButton = root.querySelector('[data-action="update"]');
        const hiddenRecord = root.querySelector("#ppi-campus-record-id");
        const hiddenUniversity = root.querySelector(".js-university-value");
        const pillLabel = root.querySelector(".js-university-pill-label");

        const typedUniversity = inputValue(".js-university-input");
        const universityName = (
            pillLabel?.textContent ||
            typedUniversity ||
            ""
        ).trim();
        const universityId = (hiddenUniversity?.value || "").trim();
        const ppiCampusId =
            (hiddenRecord?.value || "").trim() ||
            (submitButton?.dataset?.id || "").trim();

        return {
            type: "ppi_campus",
            ppi_campus_id: ppiCampusId,
            university_id: universityId,
            university: universityName,
            department: inputValue("#ppi-department"),
            position: inputValue("#ppi-position"),
            start_year: inputValue("#ppi-start-year"),
            end_year: inputValue("#ppi-end-year"),
            description: inputValue("#ppi-add-info"),
        };
    }

    function validatePPICampusModal(values) {
        if (!values) return false;
        const required = [
            ["university", "University"],
            ["university_id", "University ID"],
            ["department", "Department"],
            ["position", "Position"],
            ["start_year", "Start Year"],
            ["end_year", "End Year"],
        ];

        const missing = required
            .filter(([key]) => !values[key])
            .map(([, label]) => label);

        if (missing.length) {
            alert(`Please complete: ${missing.join(", ")}`);
            return false;
        }
        return true;
    }

    function collectPPIMModalUpdateValues(root) {
        if (!root) return null;
        const inputValue = (selector) => {
            const el = root.querySelector(selector);
            return typeof el?.value === "string" ? el.value.trim() : "";
        };

        const submitButton = root.querySelector('[data-action="update"]');
        const hiddenId = root.querySelector("#ppim-record-id");
        const ppimId =
            (hiddenId?.value || "").trim() ||
            (submitButton?.dataset?.id || "").trim();

        const department = inputValue("#ppi-department");
        const position = inputValue("#ppi-position");
        const startYear = inputValue("#ppi-start-year");
        const endYear = inputValue("#ppi-end-year");
        const addInfo = inputValue("#ppi-add-info");

        return {
            type: "ppim",
            ppim_id: ppimId,
            department,
            position,
            start_year: startYear,
            end_year: endYear,
            description: addInfo,
        };
    }

    function validateUniversityModal(values) {
        if (!values) return false;
        const required = [
            ["university", "University"],
            ["university_id", "University ID"],
            ["education_programme", "Degree Programme"],
            ["education_level", "Current Education Level"],
            ["education_graduation", "Expected Graduation Date"],
        ];

        const missing = required
            .filter(([key]) => !values[key])
            .map(([, label]) => label);

        if (missing.length) {
            alert(`Please complete: ${missing.join(", ")}`);
            return false;
        }
        return true;
    }

    function validatePPIModal(values) {
        if (!values) return false;
        const required = [
            ["university", "University"],
            ["university_id", "University ID"],
            ["department", "Department"],
            ["position", "position"],
            ["start_year", "Start Year"],
            ["end_year", "End Year"],
        ];

        const missing = required
            .filter(([key]) => !values[key])
            .map(([, label]) => label);

        if (missing.length) {
            alert(`Please complete: ${missing.join(", ")}`);
            return false;
        }
        return true;
    }

    function validatePPIMModal(values) {
        if (!values) return false;
        const required = [
            ["department", "Department"],
            ["position", "position"],
            ["start_year", "Start Year"],
            ["end_year", "End Year"],
        ];

        const missing = required
            .filter(([key]) => !values[key])
            .map(([, label]) => label);

        if (missing.length) {
            alert(`Please complete: ${missing.join(", ")}`);
            return false;
        }
        return true;
    }

    function applyStudentUpdate(result, fallback) {
        if (result?.token) {
            localStorage.setItem("token", result.token);
            api.setToken(result.token);
        }

        if (result?.student) {
            currentStudent = result.student;
            renderStudent(currentStudent);
            persistStudentSnapshot(currentStudent);
            return;
        }

        if (fallback && currentStudent) {
            currentStudent = { ...currentStudent, ...fallback };
            renderStudent(currentStudent);
            persistStudentSnapshot(currentStudent);
        }
    }

    function persistStudentSnapshot(student) {
        if (!student) return;
        try {
            sessionStorage.setItem("student", JSON.stringify(student));
        } catch (error) {
            console.warn("Unable to cache updated student", error);
        }
    }

    async function handlePersonalUpdate(event, root) {
        if (event) event.preventDefault();
        const submitButton = root?.querySelector('[data-action="update"]');
        if (submitButton?.disabled) return;

        const values = collectPersonalModalValues(root);
        if (!validatePersonalModal(values)) return;

        const payload = {
            ...values,
        };

        if (!payload.token && api?.token) {
            payload.token = api.token;
        }

        try {
            setButtonBusy(submitButton, true);
            const result = await api.edit(payload);
            applyStudentUpdate(result, {
                fullname: values.fullname,
                dob: values.dob,
                passport: values.passport,
                email: values.email,
                phone: values.phone_number,
                phone_number: values.phone_number,
                address: values.address,
                postcode_id: values.postcode_id,
                postcode: values.postcode,
            });
            if (editModalInstance?.hide) {
                editModalInstance.hide();
            }
        } catch (error) {
            console.error("Failed to update personal details", error);
            alert(`Unable to update personal details: ${error.message}`);
        } finally {
            setButtonBusy(submitButton, false);
        }
    }

    async function handleUniversityUpdate(event, root) {
        if (event) event.preventDefault();
        const submitButton = root?.querySelector('[data-action="update"]');
        if (submitButton?.disabled) return;

        const values = collectUniversityModalValues(root);
        if (!validateUniversityModal(values)) return;

        const payload = { ...values };
        if (!payload.token && api?.token) {
            payload.token = api.token;
        }

        try {
            setButtonBusy(submitButton, true);
            const result = await api.edit(payload);
            applyStudentUpdate(result, {
                university: values.university,
                university_name: values.university,
                university_id: values.university_id,
                programme: values.education_programme,
                degree_programme: values.education_programme,
                degree: values.education_programme,
                level_of_qualification_id: values.education_level,
                education_level: values.education_level,
                expected_graduate: values.education_graduation,
                expected_graduation: values.education_graduation,
                graduation_date: values.education_graduation,
            });
            if (editModalInstance?.hide) {
                editModalInstance.hide();
            }
        } catch (error) {
            console.error("Failed to update university details", error);
            alert(`Unable to update university details: ${error.message}`);
        } finally {
            setButtonBusy(submitButton, false);
        }
    }

    async function handlePPIUpdate(event, root) {
        if (event) event.preventDefault();
        const submitButton = root?.querySelector('[data-action="update"]');
        if (submitButton?.disabled) return;

        const values = collectPPIModalValues(root);
        if (!validatePPIModal(values)) return;

        const payload = { ...values };
        if (!payload.token && api?.token) {
            payload.token = api.token;
        }

        try {
            setButtonBusy(submitButton, true);
            const result = await api.addPPI(payload);
            applyStudentUpdate(result, {
                university: values.university,
                university_id: values.university_id,
                department: values.department,
                position: values.position,
                start_year: values.start_year,
                end_year: values.end_year,
                description: values.description,
            });
            if (editModalInstance?.hide) {
                editModalInstance.hide();
            }
        } catch (error) {
            console.error("Failed to update university details", error);
            alert(`Unable to update university details: ${error.message}`);
        } finally {
            setButtonBusy(submitButton, false);
        }
    }

    async function handlePPIMUpdate(event, root) {
        if (event) event.preventDefault();
        const submitButton = root?.querySelector('[data-action="update"]');
        if (submitButton?.disabled) return;

        const values = collectPPIMModalValues(root);
        if (!validatePPIMModal(values)) return;

        const payload = { ...values };
        if (!payload.token && api?.token) {
            payload.token = api.token;
        }

        try {
            setButtonBusy(submitButton, true);
            const result = await api.addPPI(payload);
            applyStudentUpdate(result, {
                department: values.department,
                position: values.position,
                start_year: values.start_year,
                end_year: values.end_year,
                description: values.description,
            });
            if (editModalInstance?.hide) {
                editModalInstance.hide();
            }
        } catch (error) {
            console.error("Failed to update university details", error);
            alert(`Unable to update university details: ${error.message}`);
        } finally {
            setButtonBusy(submitButton, false);
        }
    }

    async function handlePPICampusEditUpdate(event, root) {
        if (event) event.preventDefault();
        const submitButton = root?.querySelector('[data-action="update"]');
        if (submitButton?.disabled) return;

        const values = collectPPICampusModalUpdateValues(root);
        if (!validatePPICampusModal(values)) return;

        const payload = { ...values };
        if (!payload.token && api?.token) {
            payload.token = api.token;
        }

        try {
            setButtonBusy(submitButton, true);
            const result = await api.editPPI(payload);
            applyStudentUpdate(result, {
                university: values.university,
                university_id: values.university_id,
                department: values.department,
                position: values.position,
                start_year: values.start_year,
                end_year: values.end_year,
                description: values.description,
            });
            if (editModalInstance?.hide) {
                editModalInstance.hide();
            }
        } catch (error) {
            console.error("Failed to update PPI campus details", error);
            alert(`Unable to update PPI campus details: ${error.message}`);
        } finally {
            setButtonBusy(submitButton, false);
        }
    }

    async function handlePPIMEditUpdate(event, root) {
        if (event) event.preventDefault();
        const submitButton = root?.querySelector('[data-action="update"]');
        if (submitButton?.disabled) return;

        const values = collectPPIMModalUpdateValues(root);
        if (!validatePPIMModal(values)) return;

        const payload = { ...values };
        if (!payload.token && api?.token) {
            payload.token = api.token;
        }

        try {
            setButtonBusy(submitButton, true);
            const result = await api.editPPI(payload);
            applyStudentUpdate(result, {
                department: values.department,
                position: values.position,
                start_year: values.start_year,
                end_year: values.end_year,
                description: values.description,
            });
            if (editModalInstance?.hide) {
                editModalInstance.hide();
            }
        } catch (error) {
            console.error("Failed to update PPIM details", error);
            alert(`Unable to update PPIM details: ${error.message}`);
        } finally {
            setButtonBusy(submitButton, false);
        }
    }

    if (editModalElement) {
        editPD.addEventListener("click", (event) => editPersonalDetails(event));
        editUD.addEventListener("click", (event) =>
            editUniversityDetails(event)
        );
        addPPI.addEventListener("click", (event) => addPPICampusRecord(event));
        addPPIM.addEventListener("click", (event) => addPPIMRecord(event));
    }
    // ---- flow ----
    function run() {
        let student;
        const first = sessionStorage.getItem("student");
        if (first && (student = parseJSON(first))) {
            sessionStorage.removeItem("student");
            renderStudent(student);
        } else {
            callAPI();
        }
    }

    // ---- parse ----
    function parseJSON(first) {
        try {
            const obj = JSON.parse(first);
            return obj && typeof obj === "object" ? obj : null;
        } catch (e) {
            console.warn("Unable to parse student payload", e);
            return null;
        }
    }

    function parseRecordPayload(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
            const t = value.trim();
            if (!t) return [];
            try {
                const p = JSON.parse(t);
                if (Array.isArray(p)) return p;
                if (p && typeof p === "object") return [p];
                return [];
            } catch (e) {
                console.warn("Unable to parse record payload", e);
                return [];
            }
        }
        if (typeof value === "object") return [value];
        return [];
    }

    // ---- format ----
    function text(v, fallback = "-") {
        if (v === undefined || v === null) return fallback;
        const s = String(v).trim();
        return s || fallback;
    }

    function yearRange(start, end) {
        const s = start ? String(start).trim() : "";
        const e = end ? String(end).trim() : "";
        if (!s && !e) return "-";
        if (s && e) return `${s}/${e}`;
        if (s) return `${s}/Present`;
        return e;
    }

    function status(v) {
        if (typeof v === "string" && v.trim()) return v.trim();
        if (v === 0) return "Unverified";
        if (v === 1) return "Active";
        if (v === 2) return "Ended";
        if (v === 3) return "Rejected";
        return "-";
    }

    // ---- dom ----
    function assignText(key, value) {
        if (!key) return;
        const el = document.querySelector(`[data-profile="${key}"]`);
        if (!el) return;
        const isEmpty = value === undefined || value === null;
        const textValue = isEmpty
            ? ""
            : typeof value === "string"
            ? value.trim()
            : String(value);
        if (!textValue) {
            el.textContent = "empty";
            el.classList.add("red");
            return;
        }
        el.textContent = textValue;
        el.classList.remove("red");
    }
    async function renderPPITable(selector, records) {
        const tbody = document.querySelector(
            `[data-record-table="${selector}"]`
        );
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!records.length) {
            const tr = document.createElement("tr");
            tr.className = "liquid-table-row";
            const td = document.createElement("td");
            td.colSpan = 5;
            td.className = "text-center text-muted";
            td.textContent = "No records available.";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        for (const item of records) {
            const tr = document.createElement("tr");
            tr.className = "liquid-table-row";

            const uni = document.createElement("td");
            const universityLabel =
                item?.university ||
                (await resolveUniversityLabelById(item?.university_id));
            uni.textContent = text(universityLabel);
            tr.appendChild(uni);

            const dep = document.createElement("td");
            dep.textContent = text(item?.department);
            tr.appendChild(dep);

            const pos = document.createElement("td");
            pos.textContent = text(item?.position);
            tr.appendChild(pos);

            const year = document.createElement("td");
            year.textContent = yearRange(item?.start_year, item?.end_year);
            tr.appendChild(year);

            const st = document.createElement("td");
            const label = status(item?.status ?? item?.is_active);
            st.textContent = label;
            if (/active/i.test(label)) st.classList.add("red");
            tr.appendChild(st);

            const editbtn = document.createElement("td");
            editbtn.classList.add("text-end");
            editbtn.innerHTML = `
            <button class="btn btn-sm ms-3 liquid-btn liquid-light glass-btn ppi-btn" style="font-size: 14px; padding: 0.5rem 1rem;" data-id="${item.ppi_campus_id}">
                <i class="bi bi-pencil"></i>
            </button>
            `;
            tr.appendChild(editbtn);

            const editCampusButton = editbtn.querySelector("button");
            if (editCampusButton) {
                editCampusButton.addEventListener("click", (event) => {
                    event.preventDefault();
                    openPPICampusModal(item);
                });
            }
            tbody.appendChild(tr);
        }
    }
    function renderTable(selector, records) {
        const tbody = document.querySelector(
            `[data-record-table="${selector}"]`
        );
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!records.length) {
            const tr = document.createElement("tr");
            tr.className = "liquid-table-row";
            const td = document.createElement("td");
            td.colSpan = 5;
            td.className = "text-center text-muted";
            td.textContent = "No records available.";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        records.forEach((item) => {
            const tr = document.createElement("tr");
            tr.className = "liquid-table-row";

            const dep = document.createElement("td");
            dep.textContent = text(item?.department);
            tr.appendChild(dep);

            const pos = document.createElement("td");
            pos.textContent = text(item?.position);
            tr.appendChild(pos);

            const year = document.createElement("td");
            year.textContent = yearRange(item?.start_year, item?.end_year);
            tr.appendChild(year);

            const st = document.createElement("td");
            const label = status(item?.status ?? item?.is_active);
            st.textContent = label;
            if (/active/i.test(label)) st.classList.add("red");
            tr.appendChild(st);

            const editbtn = document.createElement("td");
            editbtn.classList.add("text-end");
            editbtn.innerHTML = `
            <button class="btn btn-sm ms-3 liquid-btn liquid-light glass-btn ppim-btn" style="font-size: 14px; padding: 0.5rem 1rem;" data-id="${item.ppim_id}">
                <i class="bi bi-pencil"></i>
            </button>
            `;
            tr.appendChild(editbtn);

            const editButton = editbtn.querySelector("button");
            if (editButton) {
                editButton.addEventListener("click", (event) => {
                    event.preventDefault();
                    openPPIMModal(item);
                });
            }
            tbody.appendChild(tr);
        });
    }

    function createModal(type, title, titleT, content) {
        if (type == "Edit") {
            btnName = "update";
        } else {
            btnName = "add";
        }
        return `
<div class="modal-header bb p0 d-flex justify-content-center">
    <div>
        <h3 class="modal-title text-center"> ${type} <span data-i18n="${titleT}">${title}</span></h3>
        <p class="mb-3 silent-text text-center" data-i18n="whole"></p>
    </div>
</div>
<form>
    <div class="modal-body">
        <div class="existing-student-details">
            <dl class="mb-0">
                <div class="row">
                ${content}
                </div>
            </dl>
        </div>
    </div>
    <div class="modal-footer bnone gap-2 d-flex justify-content-center">
        <div class="modal-button-container">
            <button type="button" class="btn liquid-btn btn-max liquid-light glass-btn btn-edit-conf" data-bs-dismiss="modal">
                <span data-i18n="cancel" id="cancel "></span>
            </button>
        </div>
        <div class="modal-button-container">
            <button type="button" class="btn glass-btn liquid-red-btn btn-max btn-edit-conf" data-action="update">
                <span data-i18n="${btnName}" id="update"></span>
            </button>
        </div>
    </div>
</form>
        `;
    }

    function createPPIModal(type, title, titleT, content) {
        return `
<div class="modal-header bb p0 d-flex justify-content-center">
    <div>
        <h3 class="modal-title text-center"> ${type} <span data-i18n="${titleT}">${title}</span></h3>
        <p class="mb-3 silent-text text-center" data-i18n="whole"></p>
    </div>
</div>
<form>
    <div class="modal-body">
        <div class="existing-student-details">
            <dl class="mb-0">
                <div class="row">
                ${content}
                </div>
            </dl>
        </div>
    </div>
    <div class="modal-footer bnone gap-2 d-flex justify-content-center">
        <div class="modal-button-container">
            <button type="button" class="btn liquid-btn btn-max liquid-light glass-btn btn-edit-conf" data-bs-dismiss="modal">
                <span data-i18n="cancel" id="cancel "></span>
            </button>
        </div>
        <div class="modal-button-container">
            <button type="button" class="btn glass-btn liquid-red-btn btn-max btn-edit-conf" data-action="update">
                <span data-i18n="update" id="update"></span>
            </button>
        </div>
    </div>
</form>
<hr>
<div class="modal-footer bnone gap-2">
<div class="w100">
<h5 data-i18n="delete-record"></h5>
<div class="form-check">
  <input class="delete-confirm form-check-input" type="checkbox" value="" id="checkDefault">
  <label class="form-check-label" for="checkDefault" data-i18n="delete-note">
  </label>
</div>
<div class="modal-button-container">
    <button type="button" class="btn glass-btn liquid-red-btn btn-max delete-btn" data-action="delete">
        <span data-i18n="delete" id="delete"></span>
    </button>
</div>
</div>
</div>
        `;
    }

    function editPersonalDetails(event) {
        if (event) event.preventDefault();
        if (!editModalElement) return;

        const editModalContent = document.getElementById("editModalContent");
        if (editModalContent) {
            const content = `
    <div class="col-12 mb-3">
        <label class="form-label" data-i18n="full-name"></label>
        <input class="form-control form-control-lg liquid-input" id="register-fullname" name="register-fullname" type="text" autocomplete="name" placeholder="R*** D****" aria-label=".form-control-lg example" />
    </div>
    <div class="col-12 col-sm-6 mb-3">
        <label class="form-label" data-i18n="dob"></label>
        <input type="date" class="form-control form-control-lg liquid-input liquid-date" id="register-dob" name="register-dob" placeholder="dd-mm-yyyy" lang="id-ID" />
    </div>
    <div class="col-12 col-sm-6 mb-3">
        <label class="form-label" data-i18n="passport"></label>
        <input class="form-control form-control-lg liquid-input" id="register-passport" name="register-passport" type="text" placeholder="X0000000" aria-label=".form-control-lg example" />
    </div>
    <div class="col-12 col-lg-6 mb-3">
        <label class="form-label" data-i18n="phone"></label>
        <div class="input-group input-group-lg liquid-input-group js-phone-group" style="z-index: 5">
            <button class="btn dropdown-toggle liquid-input-prefix js-phone-prefix" type="button" data-bs-toggle="dropdown" aria-expanded="false" data-prefix="+60" autocomplete="tel-country-code"> +60 </button>
            <ul class="dropdown-menu js-phone-menu"></ul>
            <input class="form-control form-control-lg liquid-input js-phone-input" id="register-phone" name="register-phone" type="tel" placeholder="10********" autocomplete="tel-national" aria-label="Phone number without country code" />
        </div>
    </div>
    <div class="col-12 col-lg-6 mb-3">
        <label class="form-label" data-i18n="email"></label>
        <input class="form-control form-control-lg liquid-input" id="register-email" name="register-email" type="text" placeholder="xxx@gmail.com" aria-label=".form-control-lg example" />
    </div>
    <div class="col-12 mb-3">
        <label class="form-label" data-i18n="postkode"></label>
        <div class="liquid-typeahead js-postcode-group">
            <div class="liquid-typeahead-control liquid-input js-postcode-control">
                <span class="typeahead-pill js-postcode-pill" hidden>
                    <span class="pill-label js-postcode-pill-label"></span>
                    <button type="button" class="pill-clear js-postcode-clear" aria-label="Remove selected postcode"> &times; </button>
                </span>
                <input class="typeahead-input js-postcode-input" type="text" placeholder="46000 - Petaling Jaya, Selangor" aria-label="Postcode" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" />
                <input type="hidden" class="js-postcode-value" name="postcode" />
            </div>
            <ul class="dropdown-menu js-postcode-menu" role="listbox"></ul>
        </div>
    </div>
    <div class="col-12 mb-3">
        <label class="form-label" data-i18n="Address"></label>
        <textarea class="form-control form-control-lg liquid-input" id="register-address" placeholder="Pa*** No. ***, J***" aria-label="Residential address" rows="3" autocomplete="street-address" maxlength="255"></textarea>
    </div>
            `;
            contentHTML = createModal(
                "Edit",
                "Personal Details",
                "personal-details",
                content
            );
            editModalContent.innerHTML = contentHTML;
            refreshTranslations();
            bindPersonalModalActions(editModalContent);
            initPersonalModalFeatures(editModalContent)
                .then((features) =>
                    populatePersonalModal(editModalContent, features)
                )
                .catch((error) => {
                    console.error("Personal modal features failed", error);
                    populatePersonalModal(editModalContent);
                });
        }

        if (!editModalInstance && window.bootstrap?.Modal) {
            editModalInstance =
                window.bootstrap.Modal.getOrCreateInstance(editModalElement);
        }

        if (editModalInstance?.show) {
            editModalInstance.show();
        }
    }

    function editUniversityDetails(event) {
        if (event) event.preventDefault();
        if (!editModalElement) return;

        const editModalContent = document.getElementById("editModalContent");
        if (editModalContent) {
            const content = `
<div class="mb-3">
    <label class="form-label" data-i18n="university"></label>
    <div class="liquid-typeahead js-university-group">
        <div class="liquid-typeahead-control liquid-input js-university-control">
            <span class="typeahead-pill js-university-pill" hidden>
                <span class="pill-label js-university-pill-label"></span>
                <button type="button" class="pill-clear js-university-clear" aria-label="Remove selected university"> &times; </button>
            </span>
            <input class="typeahead-input js-university-input" type="text" placeholder="University ******" name="login-university_name" aria-label="University name" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" />
            <input type="hidden" class="js-university-value" name="login-university" />
        </div>
        <ul class="dropdown-menu js-university-menu" role="listbox"></ul>
    </div>
</div>
<div class="mb-3">
    <label class="form-label" data-i18n="degree-programme"></label>
    <input class="form-control form-control-lg liquid-input" id="register-programme" type="text" placeholder="Bachelor of Artificial Intelligence" aria-label="Degree programme" />
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="education-level"></label>
    <select class="form-select form-select-lg liquid-input" id="register-education-level" aria-label="Current education level">
        <option value="" disabled selected> -- </option>
        <option value="1">Certificate</option>
        <option value="2">Diploma</option>
        <option value="3"> Undergraduate (Bachelor) </option>
        <option value="4"> Postgraduate (Master) </option>
        <option value="5"> Postgraduate (Doctorate) </option>
        <option value="6">Postdoctoral</option>
    </select>
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="expected-graduation"></label>
    <input type="date" class="form-control form-control-lg liquid-input liquid-date" id="register-expected-graduation" placeholder="dd-mm-yyyy" lang="id-ID" />
</div>
            `;
            contentHTML = createModal(
                "Edit",
                "University Details",
                "university-details",
                content
            );
            editModalContent.innerHTML = contentHTML;
            refreshTranslations();
            bindUniversityModalActions(editModalContent);
            initUniversityModalFeatures(editModalContent)
                .then((features) =>
                    populateUniversityModal(editModalContent, features)
                )
                .catch((error) => {
                    console.error("University modal features failed", error);
                    populateUniversityModal(editModalContent);
                });
        }

        if (!editModalInstance && window.bootstrap?.Modal) {
            editModalInstance =
                window.bootstrap.Modal.getOrCreateInstance(editModalElement);
        }

        if (editModalInstance?.show) {
            editModalInstance.show();
        }
    }
    function addPPICampusRecord(event) {
        if (event) event.preventDefault();
        if (!editModalElement) return;

        const editModalContent = document.getElementById("editModalContent");
        if (editModalContent) {
            const content = `
<div class="mb-3">
    <label class="form-label" data-i18n="university"></label>
    <div class="liquid-typeahead js-university-group">
        <div class="liquid-typeahead-control liquid-input js-university-control">
            <span class="typeahead-pill js-university-pill" hidden>
                <span class="pill-label js-university-pill-label"></span>
                <button type="button" class="pill-clear js-university-clear" aria-label="Remove selected university"> &times; </button>
            </span>
            <input class="typeahead-input js-university-input" type="text" placeholder="University ******" name="login-university_name" aria-label="University name" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" />
            <input type="hidden" class="js-university-value" name="login-university" />
        </div>
        <ul class="dropdown-menu js-university-menu" role="listbox"></ul>
    </div>
</div>
<div class="mb-3">
    <label class="form-label" data-i18n="department"></label>
    <input class="form-control form-control-lg liquid-input" id="ppi-department" type="text" placeholder="Intelektual" aria-label="Degree programme" />
</div>
<div class="mb-3">
    <label class="form-label" data-i18n="positioncol"></label>
    <input class="form-control form-control-lg liquid-input" id="ppi-position" type="text" placeholder="Ketua, Anggota, Sekretaris, dll" aria-label="Degree programme" />
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="start-year"></label>
    <input class="form-control form-control-lg liquid-input" type="number" id="ppi-start-year" placeholder="20**" aria-label=".form-control-lg example"/>
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="end-year"></label>
    <input class="form-control form-control-lg liquid-input" type="number" id="ppi-end-year" placeholder="20**" aria-label=".form-control-lg example"/>
</div>
<div class="col-12 mb-3">
    <label
        class="form-label"
        data-i18n="add-info2"
        >Additional Information</label
    >
    <textarea
        class="form-control form-control-lg liquid-input"
        type="text"
        placeholder="...."
        aria-label=".form-control-lg example"
        rows="3"
        id="ppi-add-info"
        maxlength="255"
    ></textarea>
</div>
<span
    style="font-size: 12px; color: gray"
    data-i18n="ppi-campus-add-note"
></span>
            `;
            contentHTML = createModal(
                "",
                "PPI Campus Record",
                "ppi-campus-record",
                content
            );
            editModalContent.innerHTML = contentHTML;
            refreshTranslations();
            bindPPIModalActions(editModalContent);
            initUniversityModalFeatures(editModalContent)
                .then((features) =>
                    populateUniversityModal(editModalContent, features)
                )
                .catch((error) => {
                    console.error("University modal features failed", error);
                    populateUniversityModal(editModalContent);
                });
        }

        if (!editModalInstance && window.bootstrap?.Modal) {
            editModalInstance =
                window.bootstrap.Modal.getOrCreateInstance(editModalElement);
        }

        if (editModalInstance?.show) {
            editModalInstance.show();
        }
    }
    function addPPIMRecord(event) {
        if (event) event.preventDefault();
        if (!editModalElement) return;

        const editModalContent = document.getElementById("editModalContent");
        if (editModalContent) {
            const content = `
<div class="mb-3">
    <label class="form-label" data-i18n="department"></label>
    <input class="form-control form-control-lg liquid-input" id="ppi-department" type="text" placeholder="Intelektual" aria-label="Degree programme" />
</div>
<div class="mb-3">
    <label class="form-label" data-i18n="positioncol"></label>
    <input class="form-control form-control-lg liquid-input" id="ppi-position" type="text" placeholder="Ketua, Anggota, Sekretaris, dll" aria-label="Degree programme" />
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="start-year"> </label>
    <input class="form-control form-control-lg liquid-input" type="number" id="ppi-start-year" placeholder="20**" aria-label=".form-control-lg example"/>
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="end-year"></label>
    <input class="form-control form-control-lg liquid-input" type="number" id="ppi-end-year" placeholder="20**" aria-label=".form-control-lg example"/>
</div>
<div class="col-12 mb-3">
    <label
        class="form-label"
        data-i18n="add-info2"
        > </label
    >
    <textarea
        class="form-control form-control-lg liquid-input"
        type="text"
        placeholder="...."
        aria-label=".form-control-lg example"
        rows="3"
        id="ppi-add-info"
        maxlength="255"
    ></textarea>
</div>
<span
    style="font-size: 12px; color: gray"
    data-i18n="ppi-malaysia-add-note"
></span>
            `;
            contentHTML = createModal(
                "",
                "PPI Malaysia Record",
                "ppi-malaysia-record",
                content
            );
            editModalContent.innerHTML = contentHTML;
            refreshTranslations();
            bindPPIMModalActions(editModalContent);
            initUniversityModalFeatures(editModalContent)
                .then((features) =>
                    populateUniversityModal(editModalContent, features)
                )
                .catch((error) => {
                    console.error("University modal features failed", error);
                    populateUniversityModal(editModalContent);
                });
        }

        if (!editModalInstance && window.bootstrap?.Modal) {
            editModalInstance =
                window.bootstrap.Modal.getOrCreateInstance(editModalElement);
        }

        if (editModalInstance?.show) {
            editModalInstance.show();
        }
    }

    function openPPIMModal(record) {
        if (!editModalElement) return;

        const editModalContent = document.getElementById("editModalContent");
        if (!editModalContent) return;

        const content = `

<div class="mb-3">
    <label class="form-label" data-i18n="department"></label>
    <input class="form-control form-control-lg liquid-input" id="ppi-department" type="text" placeholder="Intelektual" aria-label="Degree programme" />
</div>
<div class="mb-3">
    <label class="form-label" data-i18n="positioncol"></label>
    <input class="form-control form-control-lg liquid-input" id="ppi-position" type="text" placeholder="Ketua, Anggota, Sekretaris, dll" aria-label="Degree programme" />
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="start-year"> </label>
    <input class="form-control form-control-lg liquid-input" type="number" id="ppi-start-year" placeholder="20**" aria-label=".form-control-lg example"/>
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="end-year"> </label>
    <input class="form-control form-control-lg liquid-input" type="number" id="ppi-end-year" placeholder="20**" aria-label=".form-control-lg example"/>
</div>
<div class="col-12 mb-3">
    <label class="form-label" data-i18n="add-info2"> </label>
    <textarea class="form-control form-control-lg liquid-input" type="text" placeholder="...." aria-label=".form-control-lg example" rows="3" id="ppi-add-info" maxlength="255"></textarea>
</div>
<input type="hidden" id="ppim-record-id" value="${record?.ppim_id ?? ""}">
<span style="font-size: 12px; color: gray" data-i18n="ppi-malaysia-add-note">
</span>
    `;

        editModalContent.innerHTML = createPPIModal(
            "Edit",
            "PPI Malaysia Record",
            "ppi-malaysia-record",
            content
        );

        refreshTranslations();
        bindPPIMModalUpdateAction(editModalContent);

        const assignValue = (selector, value) => {
            const field = editModalContent.querySelector(selector);
            if (field) field.value = value ?? "";
        };

        assignValue("#ppi-department", record?.department);
        assignValue("#ppi-position", record?.position);
        assignValue("#ppi-start-year", record?.start_year);
        assignValue("#ppi-end-year", record?.end_year);
        assignValue("#ppi-add-info", record?.description);

        const submitBtn = editModalContent.querySelector(
            '[data-action="update"]'
        );
        if (submitBtn) submitBtn.dataset.id = record?.ppim_id ?? "";

        const deleteBtn = editModalContent.querySelector(".delete-btn");
        if (deleteBtn) deleteBtn.dataset.id = record?.ppim_id ?? "";
        bindPPIMDeleteAction(editModalContent);

        if (!editModalInstance && window.bootstrap?.Modal) {
            editModalInstance =
                window.bootstrap.Modal.getOrCreateInstance(editModalElement);
        }
        editModalInstance?.show?.();
    }

    function openPPICampusModal(record) {
        if (!editModalElement) return;

        const editModalContent = document.getElementById("editModalContent");
        if (!editModalContent) return;

        const content = `
<div class="mb-3">
    <label class="form-label" data-i18n="university"></label>
    <div class="liquid-typeahead js-university-group">
        <div class="liquid-typeahead-control liquid-input js-university-control">
            <span class="typeahead-pill js-university-pill" hidden>
                <span class="pill-label js-university-pill-label"></span>
                <button type="button" class="pill-clear js-university-clear" aria-label="Remove selected university">&times;</button>
            </span>
            <input class="typeahead-input js-university-input" type="text"
                   placeholder="University ******" aria-label="University name"
                   autocomplete="off" role="combobox" aria-autocomplete="list"
                   aria-haspopup="listbox" aria-expanded="false" />
            <input type="hidden" class="js-university-value" />
        </div>
        <ul class="dropdown-menu js-university-menu" role="listbox"></ul>
    </div>
</div>
<div class="mb-3">
    <label class="form-label" data-i18n="department"></label>
    <input class="form-control form-control-lg liquid-input" id="ppi-department" type="text"
           placeholder="Intelektual" aria-label="Degree programme" />
</div>
<div class="mb-3">
    <label class="form-label" data-i18n="positioncol"></label>
    <input class="form-control form-control-lg liquid-input" id="ppi-position" type="text"
           placeholder="Ketua, Anggota, Sekretaris, dll" aria-label="Degree programme" />
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="start-year"> </label>
    <input class="form-control form-control-lg liquid-input" type="number" id="ppi-start-year"
           placeholder="20**" aria-label=".form-control-lg example" />
</div>
<div class="col-12 col-sm-6 mb-3">
    <label class="form-label" data-i18n="end-year"> </label>
    <input class="form-control form-control-lg liquid-input" type="number" id="ppi-end-year"
           placeholder="20**" aria-label=".form-control-lg example" />
</div>
<div class="col-12 mb-3">
    <label class="form-label" data-i18n="add-info2"> </label>
    <textarea class="form-control form-control-lg liquid-input" placeholder="...."
              aria-label=".form-control-lg example" rows="3" id="ppi-add-info"
              maxlength="255"></textarea>
</div>
<input type="hidden" id="ppi-campus-record-id" value="${
            record?.ppi_campus_id ?? ""
        }">
<span style="font-size: 12px; color: gray" data-i18n="ppi-campus-add-note">
</span>
    `;

        editModalContent.innerHTML = createPPIModal(
            "Edit",
            "PPI Campus Record",
            "ppi-campus-record",
            content
        );

        refreshTranslations();
        bindPPICampusModalUpdateAction(editModalContent);

        const assignValue = (selector, value) => {
            const field = editModalContent.querySelector(selector);
            if (field) field.value = value ?? "";
        };
        const deleteBtn = editModalContent.querySelector(".delete-btn");
        if (deleteBtn) deleteBtn.dataset.id = record?.ppi_campus_id ?? "";
        bindPPICampusDeleteAction(editModalContent);

        assignValue("#ppi-department", record?.department);
        assignValue("#ppi-position", record?.position);
        assignValue("#ppi-start-year", record?.start_year);
        assignValue("#ppi-end-year", record?.end_year);
        assignValue("#ppi-add-info", record?.description);

        const submitBtn = editModalContent.querySelector(
            '[data-action="update"]'
        );
        if (submitBtn) submitBtn.dataset.id = record?.ppi_campus_id ?? "";

        const hydrateUniversity = (features) => {
            const feature = findUniversityFeature(features);
            const label =
                record?.university ||
                record?.university_name ||
                record?.university_label ||
                "";
            const value =
                record?.university_id ||
                record?.universityId ||
                record?.university ||
                "";

            if (!label) return;
            if (feature) {
                applyTypeaheadSelection(feature, {
                    value: String(value),
                    label,
                });
            } else {
                const hiddenInput = editModalContent.querySelector(
                    ".js-university-value"
                );
                const input = editModalContent.querySelector(
                    ".js-university-input"
                );
                if (hiddenInput) hiddenInput.value = String(value);
                if (input) input.value = label;
            }
        };

        initUniversityModalFeatures(editModalContent)
            .then((features) => hydrateUniversity(features))
            .catch((error) => {
                console.error("University modal features failed", error);
                hydrateUniversity(null);
            });

        if (!editModalInstance && window.bootstrap?.Modal) {
            editModalInstance =
                window.bootstrap.Modal.getOrCreateInstance(editModalElement);
        }
        editModalInstance?.show?.();
    }

    function eduLevel(num) {
        switch (num) {
            case 1:
                return "Certificate";
            case 2:
                return "Diploma";
            case 3:
                return "Undergraduate";
            case 4:
                return "Postgraduate (Master)";
            case 5:
                return "Postgraduate (PhD)";
            case 6:
                return "Postdoctoral";
            default:
                return "";
        }
    }
    // ---- render ----
    function renderStudent(student) {
        currentStudent = student || null;
        assignText(
            "surename",
            ((p = student.fullname.trim().split(/\s+/)) =>
                p.length > 1 ? `${p[0]} ${p[1]}` : p[0])()
        );
        assignText("fullname2", student.fullname);
        assignText("dob", student.dob);
        assignText("postcode_id", student.postcode_id || student.postcode);
        assignText("email", student.email);
        assignText("passport", student.passport);
        assignText("phone", student.phone || student.phone_number);
        assignText("university", student.university || student.university_name);
        assignText(
            "expected_graduate",
            student.expected_graduate ||
                student.expected_graduation ||
                student.graduation_date
        );
        assignText("address", student.address);
        assignText(
            "programme",
            student.degree_programme ||
                student.degree ||
                student.programme ||
                student.program
        );
        assignText(
            "education_level",
            eduLevel(student.level_of_qualification_id)
        );

        renderPPITable("ppi-campus", parseRecordPayload(student.ppi));
        renderTable("ppi-malaysia", parseRecordPayload(student.ppim));
        isLoaded = true;
    }

    function persistAuthResult(result = {}) {
        if (!result || typeof result !== "object") return;
        if (result.token) {
            localStorage.setItem("token", result.token);
            api.setToken(result.token);
        }

        if (result.student) {
            persistStudentSnapshot(result.student);
        }
    }
    // ---- Call API ----
    async function callAPI() {
        try {
            const result = await api.get();
            persistAuthResult(result);
            if (result.student) {
                renderStudent(result.student);
            }
        } catch (error) {
            console.error("Unable to load student data", error);
            window.location.href = "index.html";
        }
    }

    // ---- temp for testing ----
    function renderBlank() {
        currentStudent = null;
        document.querySelectorAll("[data-profile]").forEach((el) => {
            el.textContent = "empty";
            el.classList.add("red");
        });
        document.querySelectorAll("[data-record-table]").forEach((tb) => {
            tb.innerHTML = `<tr class="liquid-table-row"><td colspan="5" class="text-center text-muted">No records available.</td></tr>`;
        });
    }
})();
