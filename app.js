// app.js
document.addEventListener('DOMContentLoaded', () => {
    const DB_NAME = 'IjkingstoetsTrackerDB';
    const DB_VERSION = 1;
    const SERIES_STORE = 'series';
    const QUESTIONS_STORE = 'questions';
    const LAST_DATE_KEY = 'lastQuestionDate';

    let db;
    let activeSeriesId = null;
    let activeSeriesName = '';
    let activeSeriesTotalQuestions = 0;

    const questionDateInput = document.getElementById('questionDate');

    // --- IndexedDB Initialisatie ---
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function(event) {
                db = event.target.result;
                if (!db.objectStoreNames.contains(SERIES_STORE)) {
                    db.createObjectStore(SERIES_STORE, { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains(QUESTIONS_STORE)) {
                    const questionsStore = db.createObjectStore(QUESTIONS_STORE, { keyPath: 'id', autoIncrement: true });
                    questionsStore.createIndex('seriesId', 'seriesId', { unique: false });
                    questionsStore.createIndex('questionDate', 'questionDate', { unique: false });
                }
            };
            request.onsuccess = function(event) {
                db = event.target.result;
                console.log('IndexedDB opened successfully');
                loadSeriesIntoDropdown();
                initializeDateInput();
                resolve(db);
            };
            request.onerror = function(event) {
                console.error('IndexedDB error:', event.target.errorCode);
                reject('Error opening database');
            };
        });
    }

    function initializeDateInput() {
        const storedDate = sessionStorage.getItem(LAST_DATE_KEY);
        if (storedDate) {
            questionDateInput.value = storedDate;
        } else {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            questionDateInput.value = `${year}-${month}-${day}`;
        }
    }

    // --- Export functie ---
    async function exportData() {
        try {
            const transaction = db.transaction([SERIES_STORE, QUESTIONS_STORE], 'readonly');
            const seriesStore = transaction.objectStore(SERIES_STORE);
            const questionsStore = transaction.objectStore(QUESTIONS_STORE);
            const series = await new Promise((resolve, reject) => {
                const req = seriesStore.getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = (e) => reject(e.target.error);
            });
            const questions = await new Promise((resolve, reject) => {
                const req = questionsStore.getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = (e) => reject(e.target.error);
            });
            const exportObj = { series, questions };
            const jsonStr = JSON.stringify(exportObj, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const fileName = prompt('Geef een bestandsnaam op voor de export (zonder .json):', 'oefensessie_backup');
            if (!fileName) return;
            a.href = url;
            a.download = `${fileName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Export succesvol!');
        } catch (err) {
            console.error('Export fout:', err);
            alert('Export mislukt: ' + err.message);
        }
    }

    // --- Import functie ---
    async function importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.series || !data.questions || !Array.isArray(data.series) || !Array.isArray(data.questions)) {
                        throw new Error('Ongeldig bestandsformaat: serie- of vragenlijst ontbreekt.');
                    }
                    if (!confirm('Dit zal ALLE bestaande gegevens overschrijven. Doorgaan?')) {
                        resolve(false);
                        return;
                    }
                    // Clear existing stores
                    const clearTx = db.transaction([SERIES_STORE, QUESTIONS_STORE], 'readwrite');
                    const seriesStoreClear = clearTx.objectStore(SERIES_STORE);
                    const questionsStoreClear = clearTx.objectStore(QUESTIONS_STORE);
                    await Promise.all([
                        new Promise((res, rej) => { const req = seriesStoreClear.clear(); req.onsuccess = res; req.onerror = rej; }),
                        new Promise((res, rej) => { const req = questionsStoreClear.clear(); req.onsuccess = res; req.onerror = rej; })
                    ]);
                    // Insert series without id (let autoIncrement) and keep mapping oldId -> newId
                    const insertTx = db.transaction([SERIES_STORE, QUESTIONS_STORE], 'readwrite');
                    const seriesStore = insertTx.objectStore(SERIES_STORE);
                    const questionsStore = insertTx.objectStore(QUESTIONS_STORE);
                    const idMap = new Map();
                    for (const oldSeries of data.series) {
                        const newSeries = {
                            name: oldSeries.name,
                            totalQuestions: oldSeries.totalQuestions,
                            createdAt: oldSeries.createdAt || new Date().toISOString()
                        };
                        const newId = await new Promise((resolve, reject) => {
                            const req = seriesStore.add(newSeries);
                            req.onsuccess = () => resolve(req.result);
                            req.onerror = (e) => reject(e.target.error);
                        });
                        idMap.set(oldSeries.id, newId);
                    }
                    // Insert questions with remapped seriesId
                    for (const oldQ of data.questions) {
                        const newSeriesId = idMap.get(oldQ.seriesId);
                        if (!newSeriesId) {
                            console.warn(`Vraag overgeslagen: onbekende seriesId ${oldQ.seriesId}`);
                            continue;
                        }
                        const newQuestion = {
                            seriesId: newSeriesId,
                            questionDate: oldQ.questionDate,
                            questionId: oldQ.questionId,
                            status: oldQ.status,
                            time: oldQ.time || null,
                            repeatDate: oldQ.repeatDate || null
                        };
                        await new Promise((resolve, reject) => {
                            const req = questionsStore.add(newQuestion);
                            req.onsuccess = () => resolve();
                            req.onerror = (e) => reject(e.target.error);
                        });
                    }
                    await new Promise((resolve, reject) => {
                        insertTx.oncomplete = resolve;
                        insertTx.onerror = (e) => reject(e.target.error);
                    });
                    alert('Import succesvol! De pagina wordt herladen.');
                    activeSeriesId = null;
                    await loadSeriesIntoDropdown();
                    updateActiveSeriesDisplay();
                    resolve(true);
                } catch (err) {
                    console.error('Import fout:', err);
                    alert('Import mislukt: ' + err.message);
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'));
            reader.readAsText(file);
        });
    }

    // --- Vragenreeks Beheer (origineel) ---
    const seriesForm = document.getElementById('seriesForm');
    const activeSeriesSelect = document.getElementById('activeSeries');
    const deleteSeriesBtn = document.getElementById('deleteSeriesBtn');
    const seriesStatsDiv = document.getElementById('seriesStats');
    const questionEntrySection = document.getElementById('questionEntrySection');
    const questionResultsSection = document.getElementById('questionResultsSection');
    const currentSeriesDisplay = document.getElementById('currentSeriesDisplay');

    seriesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('seriesName').value;
        const total = parseInt(document.getElementById('totalQuestions').value);
        if (name && total > 0) {
            try {
                const transaction = db.transaction([SERIES_STORE], 'readwrite');
                const store = transaction.objectStore(SERIES_STORE);
                const series = { name: name, totalQuestions: total, createdAt: new Date().toISOString() };
                await new Promise((resolve, reject) => {
                    const request = store.add(series);
                    request.onsuccess = () => resolve();
                    request.onerror = (event) => reject(event.target.error);
                });
                seriesForm.reset();
                loadSeriesIntoDropdown();
            } catch (error) {
                console.error('Error adding series:', error);
                alert('Fout bij het toevoegen van de reeks.');
            }
        }
    });

    async function loadSeriesIntoDropdown() {
        activeSeriesSelect.innerHTML = '<option value="">-- Kies een reeks --</option>';
        try {
            const transaction = db.transaction([SERIES_STORE], 'readonly');
            const store = transaction.objectStore(SERIES_STORE);
            const allSeries = await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
            allSeries.forEach(series => {
                const option = document.createElement('option');
                option.value = series.id;
                option.textContent = series.name;
                activeSeriesSelect.appendChild(option);
            });
            if (activeSeriesId) {
                activeSeriesSelect.value = activeSeriesId;
                updateActiveSeriesDisplay();
            }
            if (allSeries.length > 0) {
                questionEntrySection.style.display = 'block';
                questionResultsSection.style.display = 'block';
            } else {
                questionEntrySection.style.display = 'none';
                questionResultsSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading series:', error);
        }
    }

    activeSeriesSelect.addEventListener('change', updateActiveSeriesDisplay);

    async function updateActiveSeriesDisplay() {
        activeSeriesId = parseInt(activeSeriesSelect.value);
        if (activeSeriesId) {
            try {
                const transaction = db.transaction([SERIES_STORE], 'readonly');
                const store = transaction.objectStore(SERIES_STORE);
                const series = await new Promise((resolve, reject) => {
                    const request = store.get(activeSeriesId);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = (event) => reject(event.target.error);
                });
                if (series) {
                    activeSeriesName = series.name;
                    activeSeriesTotalQuestions = series.totalQuestions;
                    currentSeriesDisplay.textContent = `(Reeks: ${activeSeriesName})`;
                    questionEntrySection.style.display = 'block';
                    questionResultsSection.style.display = 'block';
                    loadQuestionResults();
                    calculateAndDisplaySeriesStats();
                }
            } catch (error) {
                console.error('Error fetching active series details:', error);
                activeSeriesId = null;
            }
        } else {
            activeSeriesId = null;
            activeSeriesName = '';
            activeSeriesTotalQuestions = 0;
            currentSeriesDisplay.textContent = '';
            questionEntrySection.style.display = 'none';
            questionResultsSection.style.display = 'none';
            document.getElementById('resultsTable').querySelector('tbody').innerHTML = '';
            seriesStatsDiv.innerHTML = '';
        }
    }

    deleteSeriesBtn.addEventListener('click', async () => {
        if (activeSeriesId && confirm(`Weet je zeker dat je de reeks "${activeSeriesName}" en alle bijbehorende vragen wilt verwijderen?`)) {
            try {
                const transaction = db.transaction([SERIES_STORE, QUESTIONS_STORE], 'readwrite');
                const seriesStore = transaction.objectStore(SERIES_STORE);
                const questionsStore = transaction.objectStore(QUESTIONS_STORE);
                await new Promise((resolve, reject) => {
                    const request = seriesStore.delete(activeSeriesId);
                    request.onsuccess = () => resolve();
                    request.onerror = (event) => reject(event.target.error);
                });
                const questionsIndex = questionsStore.index('seriesId');
                const questionsToDelete = await new Promise((resolve, reject) => {
                    const req = questionsIndex.getAll(activeSeriesId);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = (event) => reject(event.target.error);
                });
                for (const q of questionsToDelete) {
                    await new Promise((resolve, reject) => {
                        const req = questionsStore.delete(q.id);
                        req.onsuccess = () => resolve();
                        req.onerror = (event) => reject(event.target.error);
                    });
                }
                alert(`Reeks "${activeSeriesName}" succesvol verwijderd.`);
                activeSeriesId = null;
                activeSeriesName = '';
                activeSeriesTotalQuestions = 0;
                loadSeriesIntoDropdown();
                updateActiveSeriesDisplay();
            } catch (error) {
                console.error('Error deleting series:', error);
                alert('Fout bij het verwijderen van de reeks.');
            }
        }
    });

    // --- Vraagresultaat Toevoegen & Weergeven ---
    const questionForm = document.getElementById('questionForm');
    const resultsTableBody = document.getElementById('resultsTable').querySelector('tbody');

    questionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeSeriesId) {
            alert('Selecteer eerst een vragenreeks om resultaten toe te voegen.');
            return;
        }
        const questionData = {
            seriesId: activeSeriesId,
            questionDate: questionDateInput.value,
            questionId: document.getElementById('questionId').value,
            status: document.getElementById('status').value,
            time: parseInt(document.getElementById('time').value) || null,
        };
        sessionStorage.setItem(LAST_DATE_KEY, questionData.questionDate);
        if (questionData.status === "Fout" || questionData.status === "Blanco" || questionData.status === "Nog niet gezien") {
            const date = new Date(questionData.questionDate);
            date.setDate(date.getDate() + 3);
            questionData.repeatDate = date.toISOString().slice(0, 10);
        } else {
            questionData.repeatDate = null;
        }
        try {
            const transaction = db.transaction([QUESTIONS_STORE], 'readwrite');
            const store = transaction.objectStore(QUESTIONS_STORE);
            await new Promise((resolve, reject) => {
                const request = store.add(questionData);
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
            document.getElementById('questionId').value = '';
            document.getElementById('status').value = 'Goed';
            document.getElementById('time').value = '';
            loadQuestionResults();
            calculateAndDisplaySeriesStats();
        } catch (error) {
            console.error('Error adding question result:', error);
            alert('Fout bij het toevoegen van het vraagresultaat.');
        }
    });

    async function loadQuestionResults() {
        resultsTableBody.innerHTML = '';
        if (!activeSeriesId) return;
        try {
            const transaction = db.transaction([QUESTIONS_STORE], 'readonly');
            const store = transaction.objectStore(QUESTIONS_STORE);
            const index = store.index('seriesId');
            const allQuestions = await new Promise((resolve, reject) => {
                const request = index.getAll(activeSeriesId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
            allQuestions.sort((a, b) => new Date(b.questionDate) - new Date(a.questionDate));
            allQuestions.forEach(question => {
                const tr = document.createElement('tr');
                tr.dataset.id = question.id;
                tr.classList.add(`status-${question.status.toLowerCase().replace(/ /g, '-')}`);
                tr.innerHTML = `
                    <td>${question.questionDate}</td>
                    <td>${question.questionId}</td>
                    <td>${question.status}</td>
                    <td>${question.time !== null ? question.time : '–'}</td>
                    <td>${question.repeatDate !== null ? question.repeatDate : '–'}</td>
                    <td><button class="delete-row-btn" data-id="${question.id}">Verwijder</button></td>
                `;
                resultsTableBody.appendChild(tr);
            });
            attachDeleteListeners();
        } catch (error) {
            console.error('Error loading question results:', error);
        }
    }

    function attachDeleteListeners() {
        document.querySelectorAll('.delete-row-btn').forEach(button => {
            button.onclick = async (e) => {
                const questionIdToDelete = parseInt(e.target.dataset.id);
                if (confirm('Weet je zeker dat je dit vraagresultaat wilt verwijderen?')) {
                    try {
                        const transaction = db.transaction([QUESTIONS_STORE], 'readwrite');
                        const store = transaction.objectStore(QUESTIONS_STORE);
                        await new Promise((resolve, reject) => {
                            const request = store.delete(questionIdToDelete);
                            request.onsuccess = () => resolve();
                            request.onerror = (event) => reject(event.target.error);
                        });
                        loadQuestionResults();
                        calculateAndDisplaySeriesStats();
                    } catch (error) {
                        console.error('Error deleting question result:', error);
                        alert('Fout bij het verwijderen van het vraagresultaat.');
                    }
                }
            };
        });
    }

    async function calculateAndDisplaySeriesStats() {
        if (!activeSeriesId) {
            seriesStatsDiv.innerHTML = '';
            return;
        }
        try {
            const transaction = db.transaction([QUESTIONS_STORE], 'readonly');
            const store = transaction.objectStore(QUESTIONS_STORE);
            const index = store.index('seriesId');
            const questions = await new Promise((resolve, reject) => {
                const request = index.getAll(activeSeriesId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });
            let goed = 0, fout = 0, blanco = 0, nogNietGezien = 0, totalAnswered = 0, totalTime = 0;
            questions.forEach(q => {
                if (q.status === 'Goed') goed++;
                else if (q.status === 'Fout') fout++;
                else if (q.status === 'Blanco') blanco++;
                else if (q.status === 'Nog niet gezien') nogNietGezien++;
                if (q.status !== 'Nog niet gezien') totalAnswered++;
                if (q.time !== null) totalTime += q.time;
            });
            const percentageGoed = totalAnswered > 0 ? ((goed / totalAnswered) * 100).toFixed(1) : 0;
            const percentageFout = totalAnswered > 0 ? ((fout / totalAnswered) * 100).toFixed(1) : 0;
            const percentageBlanco = totalAnswered > 0 ? ((blanco / totalAnswered) * 100).toFixed(1) : 0;
            const avgTimePerQuestion = totalAnswered > 0 ? (totalTime / totalAnswered).toFixed(1) : 0;
            const remainingQuestions = activeSeriesTotalQuestions - questions.length;
            const completedPercentage = activeSeriesTotalQuestions > 0 ? ((questions.length / activeSeriesTotalQuestions) * 100).toFixed(1) : 0;
            seriesStatsDiv.innerHTML = `
                <h3>Statistieken Reeks: ${activeSeriesName}</h3>
                <p>Totaal aantal vragen in reeks: <strong>${activeSeriesTotalQuestions}</strong></p>
                <p>Aantal ingevoerde vragen: <strong>${questions.length}</strong> (${completedPercentage}%)</p>
                <p>Nog te doen: <strong>${remainingQuestions}</strong></p>
                <p>Goed: <strong>${goed}</strong> (${percentageGoed}% van ingevoerde pogingen)</p>
                <p>Fout: <strong>${fout}</strong> (${percentageFout}% van ingevoerde pogingen)</p>
                <p>Blanco: <strong>${blanco}</strong> (${percentageBlanco}% van ingevoerde pogingen)</p>
                <p>Nog niet gezien: <strong>${nogNietGezien}</strong> (apart van ingevoerde pogingen)</p>
                <p>Gemiddelde tijd per ingevoerde vraag (met tijd): <strong>${avgTimePerQuestion} min</strong></p>
            `;
        } catch (error) {
            console.error('Error calculating stats:', error);
            seriesStatsDiv.innerHTML = '<p>Fout bij het laden van de statistieken.</p>';
        }
    }

    // --- Import / Export knoppen + Help dialog ---
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFileInput = document.getElementById('importFileInput');

    if (exportBtn) exportBtn.addEventListener('click', exportData);
    if (importBtn && importFileInput) {
        importBtn.addEventListener('click', () => importFileInput.click());
        importFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await importData(file);
            importFileInput.value = '';
        });
    }

    // HTML5 dialog voor handleiding - met scroll naar boven
    const helpDialog = document.getElementById('helpDialog');
    const helpBtn = document.getElementById('helpBtn');
    const closeHelpBtn = document.getElementById('closeHelpBtn');

    if (helpBtn && helpDialog) {
        helpBtn.addEventListener('click', () => {
            helpDialog.showModal();
            // Zorg dat de dialog bovenaan begint te scrollen
            helpDialog.scrollTop = 0;
        });
        if (closeHelpBtn) {
            closeHelpBtn.addEventListener('click', () => {
                helpDialog.close();
            });
        }
        helpDialog.addEventListener('click', (e) => {
            if (e.target === helpDialog) helpDialog.close();
        });
    }

    // Start de applicatie
    openDatabase();
});
