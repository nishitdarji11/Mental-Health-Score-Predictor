// Connected to FastAPI backend on port 8000
const API_BASE_URL = "http://127.0.0.1:8000";

const form = document.getElementById("predictionForm");
const submitBtn = document.getElementById("submitBtn");
const runAnotherBtn = document.getElementById("runAnotherBtn");

const stressInput = document.getElementById("stress_level");
const stressPillsContainer = document.getElementById("stressPills");
const stressPills = document.querySelectorAll(".stress-pill");

const apiErrorAlert = document.getElementById("apiErrorAlert");
const apiErrorMessage = document.getElementById("apiErrorMessage");

const signalPanel = document.getElementById("signalPanel");
const stateIdle = document.getElementById("stateIdle");
const stateLoading = document.getElementById("stateLoading");
const stateResult = document.getElementById("stateResult");

const gaugeArc = document.getElementById("gaugeArc");
const gaugePivotDot = document.getElementById("gaugePivotDot");
const predictedScoreEl = document.getElementById("predictedScore");
const signalStatusText = document.getElementById("signalStatusText");
const signalDescription = document.getElementById("signalDescription");

const ARC_LENGTH = 251.33;

// Handle Stress Level Pill Selection
stressPills.forEach((pill) => {
    pill.addEventListener("click", () => {
        stressPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        stressInput.value = pill.dataset.value;
        stressPillsContainer.classList.remove("invalid");
        validateField(stressInput);
    });
});

// Validation Rules matching StudentData Pydantic model
const validators = {
    age: (val) => {
        if (val === "") return "Required";
        const num = Number(val);
        if (!Number.isInteger(num) || num < 10 || num > 100) return "Enter age between 10 and 100";
        return "";
    },
    gender: (val) => (["Male", "Female"].includes(val) ? "" : "Select gender"),
    country: (val) => (val.trim().length > 0 ? "" : "Enter country"),
    academic_level: (val) =>
        ["Undergraduate", "Graduate", "High School"].includes(val) ? "" : "Select academic level",
    most_used_platform: (val) =>
        [
            "Facebook", "LinkedIn", "Instagram", "Snapchat", "Twitter", "YouTube",
            "TikTok", "LINE", "KakaoTalk", "VKontakte", "WhatsApp", "WeChat"
        ].includes(val)
            ? ""
            : "Select platform",
    purpose_of_use: (val) =>
        ["Networking", "Education", "Entertainment", "News"].includes(val) ? "" : "Select purpose",
    avg_daily_usage_hours: (val) => validateHours(val),
    daily_unlocks: (val) => {
        if (val === "") return "Required";
        const num = Number(val);
        if (!Number.isInteger(num) || num < 0) return "Enter a whole number ≥ 0";
        return "";
    },
    study_hours: (val) => validateHours(val),
    physical_activity_hours: (val) => validateHours(val),
    sleep_hours_per_night: (val) => validateHours(val),
    stress_level: (val) =>
        ["Low", "Medium", "High", "Very High"].includes(val) ? "" : "Select your perceived stress level"
};

function validateHours(val) {
    if (val === "") return "Required";
    const num = Number(val);
    if (isNaN(num) || num < 0 || num > 24) return "Must be 0–24 hrs";
    return "";
}

function validateField(field) {
    const name = field.name;
    const errorSpan = document.getElementById(`${name}-error`);
    if (!validators[name]) return true;

    const errorMessage = validators[name](field.value);

    if (name === "stress_level") {
        stressPillsContainer.classList.toggle("invalid", Boolean(errorMessage));
    } else {
        field.classList.toggle("invalid", Boolean(errorMessage));
    }

    if (errorSpan) errorSpan.textContent = errorMessage;
    return !errorMessage;
}

Object.keys(validators).forEach((fieldName) => {
    const field = document.getElementById(fieldName);
    if (field && fieldName !== "stress_level") {
        field.addEventListener("input", () => validateField(field));
        field.addEventListener("change", () => validateField(field));
    }
});

function buildPayload() {
    return {
        age: parseInt(document.getElementById("age").value, 10),
        gender: document.getElementById("gender").value,
        country: document.getElementById("country").value.trim(),
        academic_level: document.getElementById("academic_level").value,
        most_used_platform: document.getElementById("most_used_platform").value,
        purpose_of_use: document.getElementById("purpose_of_use").value,
        avg_daily_usage_hours: parseFloat(document.getElementById("avg_daily_usage_hours").value),
        daily_unlocks: parseInt(document.getElementById("daily_unlocks").value, 10),
        study_hours: parseFloat(document.getElementById("study_hours").value),
        physical_activity_hours: parseFloat(document.getElementById("physical_activity_hours").value),
        sleep_hours_per_night: parseFloat(document.getElementById("sleep_hours_per_night").value),
        stress_level: document.getElementById("stress_level").value
    };
}

function showPanelState(state) {
    stateIdle.classList.toggle("hidden", state !== "idle");
    stateLoading.classList.toggle("hidden", state !== "loading");
    stateResult.classList.toggle("hidden", state !== "result");
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideApiError();

    let isFormValid = true;
    Object.keys(validators).forEach((fieldName) => {
        const field = document.getElementById(fieldName);
        if (!validateField(field)) {
            isFormValid = false;
        }
    });

    if (!isFormValid) return;

    const payload = buildPayload();
    submitBtn.disabled = true;
    showPanelState("loading");

    try {
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 422 && Array.isArray(data.detail)) {
                const messages = data.detail
                    .map((err) => `${err.loc[err.loc.length - 1]}: ${err.msg}`)
                    .join(" | ");
                throw new Error(`Validation Error: ${messages}`);
            }
            throw new Error(data.detail || `Server error (${response.status})`);
        }

        renderSignalResult(data.predicted_mental_health_score);
    } catch (error) {
        showPanelState("idle");
        showApiError(
            error.message.includes("Failed to fetch")
                ? "Could not connect to the backend server. Please ensure FastAPI is running on port 8000."
                : error.message
        );
    } finally {
        submitBtn.disabled = false;
    }
});

function renderSignalResult(score) {
    showPanelState("result");

    const numericScore = Number(score);
    const clamped = Math.max(0, Math.min(10, numericScore));
    predictedScoreEl.textContent = numericScore.toFixed(2);

    gaugeArc.style.strokeDashoffset = ARC_LENGTH;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const offset = ARC_LENGTH - (clamped / 10) * ARC_LENGTH;
            gaugeArc.style.strokeDashoffset = offset;
        });
    });

    signalPanel.classList.remove("theme-strong", "theme-moderate", "theme-strain");

    if (numericScore >= 7.0) {
        signalPanel.classList.add("theme-strong");
        predictedScoreEl.style.color = "#4ade80";
        gaugePivotDot.setAttribute("fill", "#4ade80");
        signalStatusText.textContent = "Signal: strong";
        signalDescription.textContent =
            "Your habits point to a well-supported, resilient baseline. Keep it up.";
    } else if (numericScore >= 4.5) {
        signalPanel.classList.add("theme-moderate");
        predictedScoreEl.style.color = "#ffd166";
        gaugePivotDot.setAttribute("fill", "#ffd166");
        signalStatusText.textContent = "Signal: moderate";
        signalDescription.textContent =
            "Your rhythm is holding steady, though small adjustments to screen time or rest could lift your baseline.";
    } else {
        signalPanel.classList.add("theme-strain");
        predictedScoreEl.style.color = "#ff6b6b";
        gaugePivotDot.setAttribute("fill", "#ff6b6b");
        signalStatusText.textContent = "Signal: strained";
        signalDescription.textContent =
            "Your daily pattern suggests elevated load. Consider dialling back screen hours and prioritising recovery.";
    }
}

runAnotherBtn.addEventListener("click", () => {
    form.reset();
    stressInput.value = "";
    stressPills.forEach((p) => p.classList.remove("active"));
    signalPanel.classList.remove("theme-strong", "theme-moderate", "theme-strain");
    hideApiError();
    showPanelState("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
});

function showApiError(message) {
    apiErrorMessage.textContent = message;
    apiErrorAlert.classList.remove("hidden");
}

function hideApiError() {
    apiErrorAlert.classList.add("hidden");
    apiErrorMessage.textContent = "";
}