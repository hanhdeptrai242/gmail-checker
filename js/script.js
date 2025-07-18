document.addEventListener('DOMContentLoaded', () => {
    const emailList = document.getElementById('emailList');
    const emailCount = document.getElementById('emailCount');
    const clearBtn = document.getElementById('clearBtn');
    const checkBtn = document.getElementById('checkBtn');
    const threadCount = document.getElementById('threadCount');
    const delayTime = document.getElementById('delayTime');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultsSection = document.getElementById('resultsSection');
    const resultsTable = document.getElementById('resultsTable');
    const aliveCount = document.getElementById('aliveCount');
    const deadCount = document.getElementById('deadCount');
    const unknownCount = document.getElementById('unknownCount');
    const speedText = document.getElementById('speedText');
    const elapsedTimeText = document.getElementById('elapsedTime');
    const estimatedTimeText = document.getElementById('estimatedTime');

    let isChecking = false;
    let results = [];
    let processedEmails = 0;
    let totalEmails = 0;
    let checkStartTime = 0;

    // --- Utility Functions ---

    /**
     * Updates the displayed count of emails in the textarea.
     */
    const updateEmailCount = () => {
        const emails = getEmailsFromInput();
        emailCount.textContent = emails.length;
    };

    /**
     * Extracts and cleans emails from the textarea.
     * @returns {string[]} An array of trimmed, non-empty emails.
     */
    const getEmailsFromInput = () => {
        return emailList.value.trim().split('\n').filter(email => email.trim() !== '');
    };

    /**
     * Resets the UI elements to their initial state.
     */
    const resetUI = () => {
        results = [];
        processedEmails = 0;
        totalEmails = 0;
        checkStartTime = 0;

        resultsTable.innerHTML = '';
        aliveCount.textContent = '0';
        deadCount.textContent = '0';
        unknownCount.textContent = '0';
        progressText.textContent = '0/0';
        progressBar.style.width = '0%';
        speedText.textContent = '0 email/s';
        elapsedTimeText.textContent = 'Thời gian: 0s';
        estimatedTimeText.textContent = 'Còn lại: ~0s';

        progressSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
        checkBtn.disabled = false;
        checkBtn.textContent = 'Kiểm tra';
        isChecking = false;
    };

    /**
     * Updates the progress bar and statistics during checking.
     */
    const updateProgressStats = () => {
        const now = Date.now();
        const elapsed = (now - checkStartTime) / 1000;
        const speed = processedEmails / elapsed;
        const remaining = totalEmails - processedEmails;
        const estimated = speed > 0 ? remaining / speed : 0;

        speedText.textContent = `${speed.toFixed(1)} email/s`;
        elapsedTimeText.textContent = `Thời gian: ${elapsed.toFixed(0)}s`;
        estimatedTimeText.textContent = `Còn lại: ~${estimated.toFixed(0)}s`;

        const progress = (processedEmails / totalEmails) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${processedEmails}/${totalEmails}`;

        aliveCount.textContent = results.filter(r => r.status === 'alive').length;
        deadCount.textContent = results.filter(r => r.status === 'dead').length;
        unknownCount.textContent = results.filter(r => r.status === 'unknown').length;
    };

    /**
     * Adds a result row to the results table.
     * @param {object} result - The result object for an email.
     */
    const addResultRow = (result) => {
        const row = document.createElement('tr');
        row.className = 'fade-in hover:bg-gray-50';

        const statusClass = result.status === 'alive' ? 'status-alive' :
                            result.status === 'dead' ? 'status-dead' : 'status-unknown';

        const statusText = result.status === 'alive' ? 'Hoạt động' :
                           result.status === 'dead' ? 'Không hoạt động' : 'Không xác định';

        const avatarHtml = result.avatar ?
            `<img src="${result.avatar}" alt="Avatar" class="w-8 h-8 rounded-full" onerror="this.style.display='none'">` :
            '<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center"><span class="text-gray-500 text-xs">N/A</span></div>';

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${result.originalIndex}</td>
            <td class="px-6 py-4 whitespace-nowrap">${avatarHtml}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${result.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${statusClass}">● ${statusText}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${result.type || 'N/A'}</td>
        `;

        resultsTable.appendChild(row);
    };

    /**
     * Checks a single email against the API.
     * @param {string} email - The email address to check.
     * @returns {Promise<object>} A promise that resolves with the check result.
     */
    async function checkEmail(email) {
        try {
            // Step 1: Get payload
            const payloadResponse = await fetch(`https://ychecker.com/app/payload?email=${encodeURIComponent(email)}&use_credit_first=0`);
            if (!payloadResponse.ok) {
                throw new Error(`HTTP error! status: ${payloadResponse.status}`);
            }
            const payloadData = await payloadResponse.json();

            if (payloadData.code !== 200) {
                throw new Error(payloadData.message || 'Failed to get payload');
            }

            // Step 2: Check email status
            const checkResponse = await fetch(`https://api.sonjj.com/v1/check_email/?payload=${payloadData.items}`);
            if (!checkResponse.ok) {
                throw new Error(`HTTP error! status: ${checkResponse.status}`);
            }
            const checkData = await checkResponse.json();

            return {
                email: email,
                status: checkData.status === 'Ok' ? 'alive' : 'dead',
                avatar: checkData.avatar,
                type: checkData.type || 'Unknown',
                disposable: checkData.disposable
            };

        } catch (error) {
            console.error('Error checking email:', email, error);
            return {
                email: email,
                status: 'unknown',
                avatar: null,
                type: 'Unknown',
                error: error.message
            };
        }
    }

    // --- Event Listeners ---

    emailList.addEventListener('input', updateEmailCount);

    clearBtn.addEventListener('click', () => {
        emailList.value = '';
        updateEmailCount();
        resetUI();
    });

    checkBtn.addEventListener('click', async () => {
        if (isChecking) return;

        const emails = getEmailsFromInput();
        if (emails.length === 0) {
            alert('Vui lòng nhập ít nhất một email để kiểm tra!');
            return;
        }

        isChecking = true;
        checkBtn.disabled = true;
        checkBtn.textContent = 'Đang kiểm tra...';

        resetUI(); // Ensure UI is clean before starting new check
        totalEmails = emails.length;
        checkStartTime = Date.now();
        progressSection.classList.remove('hidden');
        resultsSection.classList.remove('hidden'); // Show results section immediately but empty

        const MAX_CONCURRENT = parseInt(threadCount.value, 10);
        const DELAY_TIME = parseInt(delayTime.value, 10);

        const emailQueue = emails.map((email, index) => ({ email, originalIndex: index + 1 }));
        let currentQueueIndex = 0;

        const worker = async () => {
            while (currentQueueIndex < emailQueue.length) {
                const item = emailQueue[currentQueueIndex++];
                if (!item) continue; // Skip if item is undefined

                const result = await checkEmail(item.email);
                result.originalIndex = item.originalIndex; // Preserve original index for sorting

                results.push(result);
                processedEmails++;

                // Sort results and re-render table to maintain order
                results.sort((a, b) => a.originalIndex - b.originalIndex);
                resultsTable.innerHTML = ''; // Clear existing rows
                results.forEach(addResultRow); // Re-add sorted rows

                updateProgressStats();

                if (currentQueueIndex < emailQueue.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_TIME));
                }
            }
        };

        const workers = [];
        for (let i = 0; i < MAX_CONCURRENT; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        // Final update after all checks are complete
        updateProgressStats();
        checkBtn.disabled = false;
        checkBtn.textContent = 'Kiểm tra';
        isChecking = false;
        progressSection.classList.add('hidden');
    });

    // Initial count update on page load
    updateEmailCount();
});