// Main application logic for StudyLync

// Global variables
let currentUser = null;

document.addEventListener("DOMContentLoaded", function () {
  console.log("StudyLync application initialized");

  // Check if we have a user in localStorage (simulating authentication)
  const storedUser = localStorage.getItem("studylync_user");
  if (storedUser) {
    try {
      currentUser = JSON.parse(storedUser);
      console.log("Logged in as:", currentUser);
      updateUIForLoggedInUser(currentUser);
    } catch (error) {
      console.error("Error parsing stored user:", error);
    }
  }
  loadSessions();

  // Initialize login form listener if it exists
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Initialize logout button if it exists
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }
});

// Handle user login (simulated for now)
async function handleLogin(event) {
  if (event) event.preventDefault();

  const netIdInput = document.getElementById("netId");
  const passwordInput = document.getElementById("password");

  if (!netIdInput || !passwordInput) {
    console.error("Login form inputs not found");
    return;
  }

  const netId = netIdInput.value.trim();
  const password = passwordInput.value;

  if (!netId || !password) {
    alert("Please enter your NetID and password");
    return;
  }

  try {
    const response = await fetch(`/api/users/${netId}`);

    if (response.ok) {
      const user = await response.json();

      currentUser = user;
      localStorage.setItem("studylync_user", JSON.stringify(user));

      updateUIForLoggedInUser(user);

      const loginModal = document.getElementById("loginModal");
      if (loginModal) {
        loginModal.style.display = "none";
      }
      loadSessions();
    } else {
      if (netId === "testuser" && password === "password") {
        const newUser = {
          UserNetId: netId,
          FirstName: "Test",
          LastName: "User",
          Email: `${netId}@illinois.edu`,
        };

        // Save to backend
        try {
          const createResponse = await fetch("/api/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(newUser),
          });

          if (createResponse.ok) {
            const createdUser = await createResponse.json();
            currentUser = createdUser;
            localStorage.setItem("studylync_user", JSON.stringify(createdUser));
            updateUIForLoggedInUser(createdUser);

            const loginModal = document.getElementById("loginModal");
            if (loginModal) {
              loginModal.style.display = "none";
            }
            loadSessions();
          } else {
            alert("Error creating test user");
          }
        } catch (error) {
          console.error("Error creating test user:", error);
          alert("Could not create test user");
        }
      } else {
        alert("Invalid NetID or password");
      }
    }
  } catch (error) {
    console.error("Error logging in:", error);
    alert("Error logging in. Please try again.");
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem("studylync_user");

  updateUIForLoggedOutUser();

  window.location.reload();
}

function updateUIForLoggedInUser(user) {
  // Update nav elements if they exist
  const loginButton = document.getElementById("loginButton");
  const logoutButton = document.getElementById("logoutButton");
  const userDisplay = document.getElementById("userDisplay");

  if (loginButton) loginButton.style.display = "none";
  if (logoutButton) logoutButton.style.display = "block";
  if (userDisplay) {
    userDisplay.textContent = `${user.FirstName} ${user.LastName}`;
    userDisplay.style.display = "block";
  }
}

function updateUIForLoggedOutUser() {
  const loginButton = document.getElementById("loginButton");
  const logoutButton = document.getElementById("logoutButton");
  const userDisplay = document.getElementById("userDisplay");

  if (loginButton) loginButton.style.display = "block";
  if (logoutButton) logoutButton.style.display = "none";
  if (userDisplay) userDisplay.style.display = "none";
}

function getCurrentUserNetId() {
  return currentUser ? currentUser.UserNetId : null;
}

// 1) Call DELETE on the API and remove the card from the DOM
async function deleteSession(sessionId) {
  const resp = await fetch(`/api/study-sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (resp.status === 204) {
    const el = document.getElementById(`session-${sessionId}`);
    if (el) el.remove();
  } else {
    const err = await resp.json();
    alert("Delete failed: " + err.error);
  }
}

// 2) Render a single session card (with a Delete button)
function renderSession(session) {
  const container = document.getElementById("sessionsContainer");
  const card = document.createElement("div");
  card.id = `session-${session.SessionId}`;
  card.className = "session-card";
  card.innerHTML = `
      <h4>${session.CourseTitle} @ ${session.LocationName}</h4>
      <p>${session.Description}</p>
      <small>${session.Status}</small>
      <button onclick="deleteSession(${session.SessionId})">Delete</button>
    `;
  container.appendChild(card);
}

// 3) Fetch all sessions and render them
async function loadSessions() {
  try {
    const resp = await fetch("/api/study-sessions");
    if (!resp.ok) throw new Error("Failed to fetch sessions");
    const sessions = await resp.json();
    // clear old
    document.getElementById("sessionsContainer").innerHTML = "";
    sessions.forEach(renderSession);
  } catch (e) {
    console.error(e);
    alert("Could not load sessions");
  }
}
