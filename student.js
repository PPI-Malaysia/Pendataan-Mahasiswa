// student.js (global)
class StudentAPI {
    constructor({
        base = "https://portal.ppimalaysia.id/assets/php/API/pendataan-mahasiswa.php",
        token = null,
        timeout = 12000,
    } = {}) {
        this.base = base;
        this.token = token;
        this.timeout = timeout;

        // ensure persistent ugt
        this.ugt = localStorage.getItem("ugt");
        if (!this.ugt) {
            this.ugt = crypto.randomUUID
                ? crypto.randomUUID()
                : "ppim-" + Math.random().toString(36).slice(2);
            localStorage.setItem("ugt", this.ugt);
        }
    }

    setToken(t) {
        this.token = t;
    }

    async check(profile = {}) {
        const {
            fullname,
            dob,
            passport,
            phone_number,
            university_id,
            university,
        } = profile;
        this.#require({ fullname, dob, passport, phone_number, university_id });
        return this.#post({
            action: "check",
            fullname,
            dob,
            passport,
            phone_number,
            university_id,
            university,
            w: window.innerWidth,
            ua: navigator.userAgent,
            ugt: this.ugt,
        });
    }

    async get() {
        return this.#post({
            action: "get",
            token: this.token,
            w: window.innerWidth,
            ua: navigator.userAgent,
            ugt: this.ugt,
        });
    }
    async edit(updates = {}) {
        return this.#post({
            action: "edit",
            ...updates,
            dsw: window.innerWidth,
            ua: navigator.userAgent,
            ugt: this.ugt,
        });
    }

    async add(resource, payload = {}) {
        if (!resource) throw new Error("resource required");
        return this.#post({
            action: "add",
            resource,
            ...payload,
            dsw: window.innerWidth,
            ua: navigator.userAgent,
            ugt: this.ugt,
        });
    }

    // ---- helpers ----
    async #post(body) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), this.timeout);

        const res = await fetch(this.base, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(this.token
                    ? { Authorization: `Bearer ${this.token}` }
                    : {}),
            },
            body: JSON.stringify(body),
            signal: ctrl.signal,
        }).catch((e) => {
            throw new Error(`Network error: ${e.message}`);
        });
        clearTimeout(t);

        if (!res.ok) {
            const msg = await safeText(res);
            throw new Error(`HTTP ${res.status}: ${msg || res.statusText}`);
        }
        const json = await res.json().catch(() => ({}));
        if (json?.success === false) {
            const msg = json?.error?.message || "Server rejected request";
            throw new Error(msg);
        }
        return json;
    }

    #require(obj) {
        for (const [k, v] of Object.entries(obj)) {
            if (v === undefined || v === null || String(v).trim() === "") {
                throw new Error(`${k} required`);
            }
        }
    }
}

async function safeText(r) {
    try {
        return await r.text();
    } catch {
        return "";
    }
}

window.StudentAPI = StudentAPI;
