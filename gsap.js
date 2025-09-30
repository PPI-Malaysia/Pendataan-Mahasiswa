// Wrap GSAP so all callers respect reduced motion
function to(targets, vars = {}) {
    return isReduced() ? gsap.set(targets, vars) : gsap.to(targets, vars);
}
function from(targets, vars = {}) {
    return isReduced()
        ? gsap.set(targets, { ...vars, immediateRender: true })
        : gsap.from(targets, vars);
}
function fromTo(targets, fromVars = {}, toVars = {}) {
    if (isReduced()) {
        gsap.set(targets, fromVars);
        return gsap.set(targets, toVars);
    }
    return gsap.fromTo(targets, fromVars, toVars);
}
const registBtn = document.getElementById("regist").closest("button");
const updateBtn = document.getElementById("update").closest("button");
const reg2Btn = document.getElementById("gotoRegister2");
const reg2BackBtn = document.getElementById("backtoRegister1");
const reg3Btn = document.getElementById("gotoRegister3");
const reg3BackBtn = document.getElementById("backtoRegister2");
const reg4Btn = document.getElementById("gotoRegister4");
const reg4BackBtn = document.getElementById("backtoRegister3");
const reg5Btn = document.getElementById("gotoRegister5");
const reg5BackBtn = document.getElementById("backtoRegister4");
const mm = gsap.matchMedia();

function openform() {
    gsap.to("#main-content", { width: "100%", duration: 1 });
    gsap.to("#bg-container", {
        x: "-100%",
        duration: 1,
        onComplete: () => gsap.set("#bg-container", { display: "none" }),
    });
    gsap.to(".ambient-red-2", { x: "-100%", duration: 1 });
    gsap.to(".box-content", {
        opacity: 0,
        duration: 1,
        onComplete: () => gsap.set(".box-content", { display: "none" }),
    });
}

function openform_m() {
    gsap.to("#main-content", {
        height: "100%",
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        duration: 1,
    });
    gsap.to(".app-row", {
        height: "100dvh",
        width: "100vw",
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        duration: 1,
    });
    gsap.to(".logo-container", {
        left: "60px",
        transform: "none",
        width: "3.9rem",
        duration: 1,
        ease: "power3.inOut",
    });
    gsap.to(".logo-text", {
        opacity: 0,
        duration: 1,
        onComplete: () => gsap.set(".logo-text", { display: "none" }),
    });
    gsap.to(".switch-section", {
        marginTop: "-2px",
        position: "fixed",
        duration: 1,
    });
    gsap.to(".box-content", {
        opacity: 0,
        duration: 1,
        onComplete: () => gsap.set(".box-content", { display: "none" }),
    });
}
function openform_regist() {
    openform();
    gsap.to("#register", {
        display: "block",
        onComplete: () =>
            gsap.set("#register", {
                opacity: 1,
                duration: 1,
            }),
    });
}
function regist_next(current, to, progress, currentbarspan, tobarspan) {
    gsap.to(current, {
        x: "-50%",
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
            gsap.set(current, { display: "none" }),
                gsap.set(to, { display: "block", x: "50%" }),
                gsap.to(to, {
                    x: "0%",
                    opacity: 1,
                    duration: 0.5,
                });
        },
    });
    gsap.to(progress, {
        "--p": "100",
        duration: 1,
        onComplete: () => {
            gsap.set(currentbarspan, { display: "none" }),
                gsap.set(tobarspan, { display: "block" });
        },
    });
}
function regist_prev(current, to, progress, currentbarspan, tobarspan) {
    gsap.to(current, {
        x: "50%",
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
            gsap.set(current, { display: "none" }),
                gsap.set(to, { display: "block", x: "-50%" }),
                gsap.to(to, {
                    x: "0%",
                    opacity: 1,
                    duration: 0.5,
                });
        },
    });
    gsap.to(progress, {
        "--p": "0",
        duration: 1,
        onComplete: () => {
            gsap.set(currentbarspan, { display: "none" }),
                gsap.set(tobarspan, { display: "block" });
        },
    });
}
function regist_next_m(current, to, progress, currentbarspan, tobarspan) {
    gsap.to(current, {
        y: "-10%",
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
            gsap.set(current, { display: "none" }),
                gsap.set(to, {
                    display: "block",
                    y: "20%",
                }),
                gsap.to(to, {
                    y: "0",
                    opacity: 1,
                    duration: 0.5,
                });
        },
    });
    gsap.to(progress, {
        "--p": "100",
        duration: 1,
        onComplete: () => {
            gsap.set(currentbarspan, { display: "none" }),
                gsap.set(tobarspan, { display: "block" });
        },
    });
}
function regist_prev_m(current, to, progress, currentbarspan, tobarspan) {
    gsap.to(current, {
        y: "20%",
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
            gsap.set(current, { display: "none" }),
                gsap.set(to, { display: "block", y: "-10%" }),
                gsap.to(to, {
                    y: "0%",
                    opacity: 1,
                    duration: 0.5,
                });
        },
    });
    gsap.to(progress, {
        "--p": "0",
        duration: 1,
        onComplete: () => {
            gsap.set(currentbarspan, { display: "none" }),
                gsap.set(tobarspan, { display: "block" });
        },
    });
}

function openform_update() {
    openform();
    gsap.to("#updateProfile", {
        display: "block",
        onComplete: () =>
            gsap.set("#updateProfile", {
                opacity: 1,
                duration: 1,
            }),
    });
}
function openform_regis_m() {
    openform_m();
    gsap.to("#register", {
        display: "block",
        onComplete: () =>
            gsap.set("#register", {
                opacity: 1,
                duration: 1,
            }),
    });
}
function openform_update_m() {
    openform_m();
    gsap.to("#updateProfile", {
        display: "block",
        onComplete: () =>
            gsap.set("#updateProfile", {
                opacity: 1,
                duration: 1,
            }),
    });
}
mm.add("(min-width: 992px)", () => {
    registBtn.onclick = openform_regist;
    updateBtn.onclick = openform_update;
    reg2Btn.onclick = () =>
        regist_next(
            "#register1",
            "#register2",
            "#register2-progress",
            "#barspan1",
            "#barspan2"
        );
    reg2BackBtn.onclick = () =>
        regist_prev(
            "#register2",
            "#register1",
            "#register2-progress",
            "#barspan2",
            "#barspan1"
        );
    reg3Btn.onclick = () =>
        regist_next(
            "#register2",
            "#register3",
            "#register3-progress",
            "#barspan2",
            "#barspan3"
        );
    reg3BackBtn.onclick = () =>
        regist_prev(
            "#register3",
            "#register2",
            "#register3-progress",
            "#barspan3",
            "#barspan2"
        );
    reg4Btn.onclick = () =>
        regist_next(
            "#register3",
            "#register4",
            "#register4-progress",
            "#barspan3",
            "#barspan4"
        );
    reg4BackBtn.onclick = () =>
        regist_prev(
            "#register4",
            "#register3",
            "#register4-progress",
            "#barspan4",
            "#barspan3"
        );
    reg5Btn.onclick = () =>
        regist_next(
            "#register4",
            "#register5",
            "#register5-progress",
            "#barspan4",
            "#barspan5"
        );
    reg5BackBtn.onclick = () =>
        regist_prev(
            "#register5",
            "#register4",
            "#register5-progress",
            "#barspan5",
            "#barspan4"
        );
});

mm.add("(max-width: 991.98px)", () => {
    registBtn.onclick = openform_regis_m;
    updateBtn.onclick = openform_update_m;
    reg2Btn.onclick = () =>
        regist_next_m(
            "#register1",
            "#register2",
            "#register2-progress",
            "#barspan1",
            "#barspan2"
        );
    reg2BackBtn.onclick = () =>
        regist_prev_m(
            "#register2",
            "#register1",
            "#register2-progress",
            "#barspan2",
            "#barspan1"
        );
    reg3Btn.onclick = () =>
        regist_next_m(
            "#register2",
            "#register3",
            "#register3-progress",
            "#barspan2",
            "#barspan3"
        );
    reg3BackBtn.onclick = () =>
        regist_prev_m(
            "#register3",
            "#register2",
            "#register3-progress",
            "#barspan3",
            "#barspan2"
        );
    reg4Btn.onclick = () =>
        regist_next_m(
            "#register3",
            "#register4",
            "#register4-progress",
            "#barspan3",
            "#barspan4"
        );
    reg4BackBtn.onclick = () =>
        regist_prev_m(
            "#register4",
            "#register3",
            "#register4-progress",
            "#barspan4",
            "#barspan3"
        );
    reg5Btn.onclick = () =>
        regist_next_m(
            "#register4",
            "#register5",
            "#register5-progress",
            "#barspan4",
            "#barspan5"
        );
    reg5BackBtn.onclick = () =>
        regist_prev_m(
            "#register5",
            "#register4",
            "#register5-progress",
            "#barspan5",
            "#barspan4"
        );
});
