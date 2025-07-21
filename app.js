// app.js
document.addEventListener('DOMContentLoaded', () => {
    const DB_NAME = 'IjkingstoetsTrackerDB';
    const DB_VERSION = 1; // Increment this version number if you change your database schema
    const SERIES_STORE = 'series';
    const QUESTIONS_STORE = 'questions';
    const LAST_DATE_KEY = 'lastQuestionDate'; // Key for sessionStorage

    let db;
    let activeSeriesId = null;
    let activeSeriesName = '';
    let activeSeriesTotalQuestions = 0;

    const questionDateInput = document.getElementById('questionDate'); // Haal het datumveld op

    // --- IndexedDB Initialisatie ---
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function(event) {
                db = event.target.result;
                // Create object store for series
                if (!db.objectStoreNames.contains(SERIES_STORE)) {
                    db.createObjectStore(SERIES_STORE, { keyPath: 'id', autoIncrement: true });
                }
                // Create object store for questions
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
                initializeDateInput(); // Initialiseer het datumveld na laden van DB
                resolve(db);
            };

            request.onerror = function(event) {
                console.error('IndexedDB error:', event.target.errorCode);
                reject('Error opening database');
            };
        });
    }

    // --- Functie om de datum in te stellen en te onthouden ---
    function initializeDateInput() {
        const storedDate = sessionStorage.getItem(LAST_DATE_KEY);
        if (storedDate) {
            questionDateInput.value = storedDate;
        } else {
            // Zet de datum op vandaag als er nog geen datum is opgeslagen
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0'); // Maanden zijn 0-indexed
            const day = String(today.getDate()).padStart(2, '0');
            questionDateInput.value = `${year}-${month}-${day}`;
        }
    }

    // --- Vragenreeks Beheer (ongewijzigd t.o.v. vorige versie) ---
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
                console.log('Series added:', series);
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
            questionDate: questionDateInput.value, // Gebruik de waarde uit het inputveld
            questionId: document.getElementById('questionId').value,
            status: document.getElementById('status').value,
            time: parseInt(document.getElementById('time').value) || null,
        };

        // Sla de laatst gebruikte datum op in sessionStorage
        sessionStorage.setItem(LAST_DATE_KEY, questionData.questionDate);


        // Bereken herhaling (3 dagen later voor Fout/Blanco/Nog niet gezien)
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
            console.log('Question result added:', questionData);
            // questionForm.reset(); // Reset het formulier NIET om de datum te behouden
            document.getElementById('questionId').value = ''; // Reset alleen Vraag-ID
            document.getElementById('status').value = 'Goed'; // Reset status naar standaard
            document.getElementById('time').value = ''; // Reset tijd

            loadQuestionResults();
            calculateAndDisplaySeriesStats();
        } catch (error) {
            console.error('Error adding question result:', error);
            alert('Fout bij het toevoegen van het vraagresultaat.');
        }
    });

    async function loadQuestionResults() {
        resultsTableBody.innerHTML = ''; // Clear table
        if (!activeSeriesId) return;

        try {
            const transaction = db.transaction([QUESTIONS_STORE], 'readonly');
            const store = transaction.objectStore(QUESTIONS_STORE);
            const index = store.index('seriesId');
            const allQuestions = await new Promise((resolve, reject) => {
                const request = index.getAll(activeSeriesId); // Get all questions for the active series
                request.onsuccess = () => resolve(request.result);
                request.onerror = (event) => reject(event.target.error);
            });

            // Sort by date descending
            allQuestions.sort((a, b) => new Date(b.questionDate) - new Date(a.questionDate));

            allQuestions.forEach(question => {
                const tr = document.createElement('tr');
                tr.dataset.id = question.id; // Store question ID for deletion
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
                        console.log('Question result deleted:', questionIdToDelete);
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

            let goed = 0;
            let fout = 0;
            let blanco = 0;
            let nogNietGezien = 0;
            let totalAnswered = 0;
            let totalTime = 0;

            questions.forEach(q => {
                if (q.status === 'Goed') {
                    goed++;
                } else if (q.status === 'Fout') {
                    fout++;
                } else if (q.status === 'Blanco') {
                    blanco++;
                } else if (q.status === 'Nog niet gezien') {
                    nogNietGezien++;
                }
                if (q.status !== 'Nog niet gezien') { // Consider this as attempted/answered for some stats
                    totalAnswered++;
                }
                if (q.time !== null) {
                    totalTime += q.time;
                }
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


    // Start de applicatie door de database te openen
    openDatabase();
});
