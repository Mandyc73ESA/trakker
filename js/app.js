const timerForm = document.getElementById('timerForm');
const startButton = document.getElementById('startButton');
const statusMessage = document.getElementById('statusMessage');
const billingStatus = document.getElementById('billingStatus');
const billingRateField = document.getElementById('billingRateField');
const billingRateInput = document.getElementById('billingRate');
const installButton = document.getElementById('installButton');
const currentYear = document.getElementById('currentYear');

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

const showBillingRate = () => {
    const needsBillingRate = billingStatus.value === 'Billable';
    billingRateField.toggleAttribute('data-hidden', !needsBillingRate);
    if (!needsBillingRate) {
        billingRateInput.value = '';
    }
};

billingStatus?.addEventListener('change', showBillingRate);
showBillingRate();

const setBusy = (isBusy) => {
    startButton.setAttribute('aria-busy', String(isBusy));
    startButton.disabled = isBusy;
};

const setStatus = (message, type = '') => {
    statusMessage.dataset.status = type;
    statusMessage.textContent = message;
};

const clearStatus = () => {
    delete statusMessage.dataset.status;
    statusMessage.textContent = '';
};

const serializeForm = () => {
    const formData = new FormData(timerForm);
    const payload = Object.fromEntries(formData.entries());

    if (payload.billingRate === '') {
        payload.billingRate = null;
    } else if (payload.billingRate != null) {
        payload.billingRate = Number(payload.billingRate);
    }

    if (payload.billingStatus === '') {
        payload.billingStatus = null;
    }

    return payload;
};

const validate = (payload) => {
    if (payload.billingStatus === 'Billable' && (payload.billingRate == null || Number.isNaN(payload.billingRate))) {
        return 'Please provide a billing rate for billable time entries.';
    }
    return null;
};

const submitTimerStart = async (event) => {
    event.preventDefault();
    clearStatus();

    const payload = serializeForm();
    const validationError = validate(payload);

    if (validationError) {
        setStatus(validationError, 'error');
        billingRateInput.focus();
        return;
    }

    setBusy(true);
    setStatus('Starting timer…');

    try {
        const response = await fetch('https://localhost:7233/timer/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => null);
            const errorMessage = errorPayload?.error || 'Unable to start the timer. Please review the form and try again.';
            throw new Error(errorMessage);
        }

        const result = await response.json();
        const startedAt = new Date(result.startTimeUtc ?? Date.now());
        setStatus(`Timer started at ${startedAt.toLocaleString()}. Entry id: ${result.id}.`, 'success');
        timerForm.reset();
        showBillingRate();
    } catch (error) {
        console.error(error);
        setStatus(error.message || 'Something went wrong while starting the timer.', 'error');
    } finally {
        setBusy(false);
    }
};

timerForm?.addEventListener('submit', submitTimerStart);

let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) {
        installButton.hidden = false;
    }
});

installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
        return;
    }
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
        installButton.hidden = true;
    }
    deferredInstallPrompt = null;
});

if ('serviceWorker' in navigator) {
    const registerServiceWorker = async () => {
        const candidateUrls = ['/service-worker.js', 'service-worker.js'];
        let lastError = null;

        for (const url of candidateUrls) {
            try {
                return await navigator.serviceWorker.register(url);
            } catch (error) {
                lastError = error;
                console.warn(`Service worker registration failed for ${url}`, error);
            }
        }

        throw lastError ?? new Error('Service worker registration failed for all candidate URLs.');
    };

    window.addEventListener('load', () => {
        registerServiceWorker().catch((error) => {
            console.error('Service worker registration failed', error);
        });
    });
}
