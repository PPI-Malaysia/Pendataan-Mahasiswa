(function () {
    const ugt = localStorage.getItem("ugt");
    const token = localStorage.getItem("token");
    if (!ugt || !token) {
        window.location.href = "index.html";
    }
    const api = new StudentAPI({ token: token });
    run();

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

            tbody.appendChild(tr);
        });
    }

    // ---- render ----
    function renderStudent(student) {
        assignText("fullname", student.fullname);
        assignText("fullname2", student.fullname);
        assignText("dob", student.dob);
        assignText("postcode_id", student.postcode_id);
        assignText("email", student.email);
        assignText("passport", student.passport);
        assignText("phone", student.phone);
        assignText("university", student.university);
        assignText("expected_graduate", student.expected_graduate);
        assignText("address", student.address);
        assignText("programme", student.programme);
        assignText("education_level", student.level_of_qualification_id);

        renderTable("ppi-campus", parseRecordPayload(student.ppi));
        renderTable("ppi-malaysia", parseRecordPayload(student.ppim));
    }

    function persistAuthResult(result = {}) {
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
        document.querySelectorAll("[data-profile]").forEach((el) => {
            el.textContent = "empty";
            el.classList.add("red");
        });
        document.querySelectorAll("[data-record-table]").forEach((tb) => {
            tb.innerHTML = `<tr class="liquid-table-row"><td colspan="5" class="text-center text-muted">No records available.</td></tr>`;
        });
    }
})();
