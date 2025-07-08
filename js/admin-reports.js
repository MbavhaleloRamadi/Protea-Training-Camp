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
            console.log("No user logged in. Redirecting to login.");
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
            // This function is updated to process data in the new format
            const processedData = await fetchAndProcessSubmissions(selectedUserId);
            // This function is updated to generate the new Excel layout
            generateExcel(processedData, selectedUserId);
        } catch (error) {
            console.error("Error generating report:", error);
            alert("Failed to generate report. See console for details.");
        } finally {
            loadingMessage.style.display = "none";
            downloadBtn.disabled = false;
        }
    });

    // ───────────────────────────────────────────────────────────
    // DATA FETCHING AND PROCESSING (MODIFIED)
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

                // Ensure date and username exist before processing
                if (!date || !username) continue;

                // Create a unique key for the day and player
                const dayPlayerKey = `${date}_${username}`;

                if (!processedData[dayPlayerKey]) {
                    processedData[dayPlayerKey] = {
                        "Date": date,
                        "Player Name": username,
                        "Putting": 0,
                        "Chipping": 0,
                        "Irons & Tee Shot": 0,
                        "Mental": 0,
                        "On The Course": 0,
                        "Tournament Prep": 0,
                        "Fitness": 0,
                        "Total Daily Points": 0
                    };
                }
                
                // Get points from categories sub-collection
                const categoriesSnapshot = await subDoc.ref.collection("categories").get();
                categoriesSnapshot.forEach(catDoc => {
                    const categoryData = catDoc.data();
                    const categoryName = categoryData.categoryDisplayName;
                    const points = categoryData.totalPoints || 0;

                    if (processedData[dayPlayerKey].hasOwnProperty(categoryName)) {
                        processedData[dayPlayerKey][categoryName] += points;
                        processedData[dayPlayerKey]["Total Daily Points"] += points;
                    }
                });
            }
        }
        return Object.values(processedData); // Return as an array
    }

    // ───────────────────────────────────────────────────────────
    // EXCEL FILE GENERATION (MODIFIED)
    // ───────────────────────────────────────────────────────────
    function generateExcel(data, selectedUserId) {
        if (!data || data.length === 0) {
            alert("No practice data found for the selected user(s).");
            return;
        }

        // Sort data by Date, then by Player Name
        data.sort((a, b) => {
            if (a.Date < b.Date) return -1;
            if (a.Date > b.Date) return 1;
            if (a["Player Name"] < b["Player Name"]) return -1;
            if (a["Player Name"] > b["Player Name"]) return 1;
            return 0;
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Define the headers in the exact order you want
        const headers = [
            "Date", 
            "Player Name", 
            "Putting", 
            "Chipping", 
            "Irons & Tee Shot", 
            "Mental", 
            "On The Course", 
            "Tournament Prep", 
            "Fitness", 
            "Total Daily Points"
        ];
        
        // Set the header for the worksheet
        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A1" });


        // Append the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, "Practice Report");

        const userName = selectedUserId === 'all' ? 'All_Users' : userSelector.options[userSelector.selectedIndex].text;
        const fileName = `Practice_Report_${userName}_${new Date().toISOString().split('T')[0]}.xlsx`;

        XLSX.writeFile(wb, fileName);
    }
});