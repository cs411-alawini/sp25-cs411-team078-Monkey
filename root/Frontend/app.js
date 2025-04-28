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

  // Initialize login form listener if it exists
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Initialize signup form listener if it exists
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", handleSignup);
  }

  // Initialize logout button if it exists
  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }
});


async function joinStudySession(sessionId) {
  const storedUser = JSON.parse(localStorage.getItem('studylync_user'));
  if (!storedUser) {
    alert('You must be logged in to join a session.');
    return;
  }

  try {
    const response = await fetch(`/api/study-sessions/${sessionId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ netId: storedUser.UserNetId })
    });

    if (response.ok) {
      const result = await response.json();
      alert('Joined the study session successfully!');

      //  Update SessionId in localStorage
      const updatedUser = { ...storedUser, SessionId: sessionId };
      localStorage.setItem('studylync_user', JSON.stringify(updatedUser));

      // Update currentUser global variable too
      currentUser = updatedUser;

      // Re-check Delete button visibility
      checkDeleteButtonVisibility();

    } else {
      const errorData = await response.json();
      alert('Error joining session: ' + errorData.error);
    }
  } catch (error) {
    console.error('Failed to join study session:', error);
    alert('An unexpected error occurred.');
  }
}

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
          const res = await fetch(`/api/users/${encodeURIComponent(netId)}`);
          if (!res.ok) {
            return alert("No such user. Please sign up first.");
          }
          const user = await res.json();

          // check password
          if (user.Password !== password) {
            return alert("Invalid credentials.");
          }

          // success!
          currentUser = user;
          localStorage.setItem("studylync_user", JSON.stringify(user));
          updateUIForLoggedInUser(user);
          document.getElementById("loginModal").style.display = "none";
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

// Handle user signup
async function handleSignup(event) {
  event.preventDefault();

  const netId = document.getElementById("suNetId").value.trim();
  const firstName = document.getElementById("suFirstName").value.trim();
  const lastName = document.getElementById("suLastName").value.trim();
  const email = document.getElementById("suEmail").value.trim();
  const password = document.getElementById("suPassword").value;

  if (!netId || !firstName || !lastName || !email || !password) {
    return alert("All fields are required.");
  }

  const newUser = {
    UserNetId: netId,
    FirstName: firstName,
    LastName: lastName,
    Email: email,
    Password: password,
  };

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (!res.ok) throw new Error(await res.text());

    const created = await res.json();
    // auto‐login after signup
    currentUser = created;
    localStorage.setItem("studylync_user", JSON.stringify(created));
    updateUIForLoggedInUser(created);
    document.getElementById("signupModal").style.display = "none";
  } catch (err) {
    console.error("Signup error:", err);
    alert("Could not create account. Maybe that NetID is taken?");
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
