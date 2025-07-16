document.addEventListener("DOMContentLoaded", () => {
    // ───────────────────────────────────────────────────────────
    // FIREBASE INITIALIZATION
    // ───────────────────────────────────────────────────────────
    const firebaseConfig = {
        apiKey: "AIzaSyCLFOHGb5xaMSUtE_vgVO0aaY6MfLySeTs",
        authDomain: "protea-training-camp.firebaseapp.com",
        projectId: "protea-training-camp",
        storageBucket: "protea-training-camp.appspot.com",
        messagingSenderId: "649833361697",
        appId: "1:649833361697:web:5c402a67872ca10fe30e60",
        measurementId: "G-K1HKHPG6HG"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const db = firebase.firestore();
    const auth = firebase.auth();

    const downloadBtn = document.getElementById("downloadReportBtn");
    const userSelector = document.getElementById("userSelector");
    const loadingMessage = document.getElementById("loadingMessage");

    // ───────────────────────────────────────────────────────────
    // AUTH CHECK AND USER POPULATION
    // ───────────────────────────────────────────────────────────
    auth.onAuthStateChanged(user => {
        if (user) {
            populateUserSelector();
            downloadBtn.disabled = false;
        } else {
            window.location.href = "login.html";
            downloadBtn.disabled = true;
        }
    });

    async function populateUserSelector() {
        try {
            const usersSnapshot = await db.collection("users").get();
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const option = document.createElement("option");
                option.value = doc.id;
                option.textContent = userData.username || userData.fullName || "Unnamed User";
                userSelector.appendChild(option);
            });
        } catch (error) {
            console.error("Error populating user selector:", error);
        }
    }

    // ───────────────────────────────────────────────────────────
    // EVENT LISTENER FOR THE DOWNLOAD BUTTON
    // ───────────────────────────────────────────────────────────
    downloadBtn.addEventListener("click", async () => {
        loadingMessage.style.display = "block";
        downloadBtn.disabled = true;
        const selectedUserId = userSelector.value;
        try {
            const processedData = await fetchAndProcessSubmissions(selectedUserId);
            generateExcel(processedData);
        } catch (error) {
            console.error("Error generating report:", error);
            alert("Failed to generate report. See console for details.");
        } finally {
            loadingMessage.style.display = "none";
            downloadBtn.disabled = false;
        }
    });

    // ───────────────────────────────────────────────────────────
    // DATA FETCHING AND PROCESSING (MODIFIED FOR PRACTICE-LEVEL DETAIL)
    // ───────────────────────────────────────────────────────────
    async function fetchAndProcessSubmissions(userId) {
        const processedData = {};
        let usersToProcess = [];

        if (userId === 'all') {
            const usersSnapshot = await db.collection("users").get();
            usersSnapshot.forEach(doc => usersToProcess.push({ id: doc.id, data: doc.data() }));
        } else {
            const userDoc = await db.collection("users").doc(userId).get();
            if (userDoc.exists) {
                usersToProcess.push({ id: userDoc.id, data: userDoc.data() });
            }
        }

        for (const user of usersToProcess) {
            const submissionsSnapshot = await db.collection("users").doc(user.id).collection("practice_submissions").get();
            
            for (const subDoc of submissionsSnapshot.docs) {
                const submissionData = subDoc.data();
                const date = submissionData.date;
                const username = user.data.username || user.data.fullName || "Unnamed User";
                if (!date || !username) continue;

                const dayPlayerKey = `${date}_${username}`;
                if (!processedData[dayPlayerKey]) {
                    // Initialize with arrays to hold practice strings
                    processedData[dayPlayerKey] = {
                        "Date": date,
                        "Player": username,
                        "Putting": [],
                        "Chipping": [],
                        "Irons & Tee Shot": [],
                        "Mental": [],
                        "On The Course": [],
                        "Tournament Prep": [],
                        "Fitness": [],
                        "Total Daily Points": 0
                    };
                }
                
                const categoriesSnapshot = await subDoc.ref.collection("categories").get();
                for (const catDoc of categoriesSnapshot.docs) {
                    const categoryData = catDoc.data();
                    const categoryName = categoryData.categoryDisplayName;
                    const practices = categoryData.practices || [];

                    for (const practice of practices) {
                        // Calculate points for this specific practice, accounting for double points
                        const practicePoints = practice.isDoublePoints ? (practice.points || 0) * 2 : (practice.points || 0);
                        const practiceName = practice.name || practice.practiceDescription || "Unnamed Practice";

                        // Create the string "Practice Name (X pts)"
                        const practiceDetailString = `${practiceName} (${practicePoints} pts)`;

                        // Add the string to the correct category array
                        if (processedData[dayPlayerKey].hasOwnProperty(categoryName)) {
                            processedData[dayPlayerKey][categoryName].push(practiceDetailString);
                            processedData[dayPlayerKey]["Total Daily Points"] += practicePoints;
                        }
                    }
                }
            }
        }
        return Object.values(processedData);
    }

    // ───────────────────────────────────────────────────────────
    // EXCEL FILE GENERATION (MODIFIED TO HANDLE LISTS OF PRACTICES)
    // ───────────────────────────────────────────────────────────
    function generateExcel(data) {
        if (!data || data.length === 0) {
            alert("No practice data found for the selected user(s).");
            return;
        }
        
        // Join the arrays of practices into newline-separated strings for each cell
        const dataForSheet = data.map(row => ({
            "Date of Submission": row.Date,
            "Player": row.Player,
            "Putting Practice": row.Putting.join('\n'),
            "Chipping Practice": row.Chipping.join('\n'),
            "Irons & Tee Shots": row["Irons & Tee Shot"].join('\n'),
            "Mind Gym": row.Mental.join('\n'),
            "On-Course Performance": row["On The Course"].join('\n'),
            "Tournament Preparation": row["Tournament Prep"].join('\n'),
            "Fitness & Wellness": row.Fitness.join('\n'),
            "Daily Point Total": row["Total Daily Points"]
        }));

        dataForSheet.sort((a, b) => {
            const dateA = new Date(a["Date of Submission"]);
            const dateB = new Date(b["Date of Submission"]);
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
            if (a.Player < b.Player) return -1;
            if (a.Player > b.Player) return 1;
            return 0;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataForSheet);

        ws['!cols'] = [
            { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
            { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 18 }
        ];

        // --- NEW: Set row heights to auto-fit the content ---
        // This makes sure the list of practices is visible
        ws['!rows'] = dataForSheet.map((row, i) => {
            // Find the category with the most practices for this row
            const maxPractices = Math.max(
                row["Putting Practice"].split('\n').length,
                row["Chipping Practice"].split('\n').length,
                row["Irons & Tee Shots"].split('\n').length,
                row["Mind Gym"].split('\n').length,
                row["On-Course Performance"].split('\n').length,
                row["Tournament Preparation"].split('\n').length,
                row["Fitness & Wellness"].split('\n').length
            );
            // Set row height based on number of lines (15 pts per line)
            return { hpt: Math.max(15, (maxPractices -1) * 15) };
        });


        XLSX.utils.book_append_sheet(wb, ws, "Practice Report");

        const fileName = `Practice_Detail_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }
});