
// Global variables
let currentUser = null;

document.addEventListener("DOMContentLoaded", function () {
  console.log("StudyLync application initialized");

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

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", handleSignup);
  }

  const logoutButton = document.getElementById("logoutButton");
  if (logoutButton) {
    logoutButton.addEventListener("click", handleLogout);
  }
});

async function joinStudySession(sessionId) {
  const storedUser = JSON.parse(localStorage.getItem("studylync_user"));
  if (!storedUser) {
    alert("You must be logged in to join a session.");
    return;
  }

  try {
    const response = await fetch(`/api/study-sessions/${sessionId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ netId: storedUser.UserNetId }),
    });

    if (response.ok) {
      const result = await response.json();
      alert("Joined the study session successfully!");

      //  Update SessionId in localStorage
      const updatedUser = { ...storedUser, SessionId: sessionId };
      localStorage.setItem("studylync_user", JSON.stringify(updatedUser));

      // Update currentUser global variable too
      currentUser = updatedUser;

      // Re-check Delete button visibility
      checkDeleteButtonVisibility();
    } else {
      const errorData = await response.json();
      alert("Error joining session: " + errorData.error);
    }
  } catch (error) {
    console.error("Failed to join study session:", error);
    alert("An unexpected error occurred.");
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

// Initialize review form listener
const reviewForm = document.getElementById("reviewForm");
if (reviewForm) {
  reviewForm.addEventListener("submit", handleReviewSubmit);
}

// Load reviews on page load
fetchReviewsFromBackend();

async function handleReviewSubmit(event) {
  event.preventDefault();

  const ratingInput = document.getElementById("rating");
  const commentInput = document.getElementById("comment");

  const rating = parseInt(ratingInput.value);
  const comment = commentInput.value.trim();

  if (!currentUser) {
    return alert("You must be logged in to leave a review.");
  }

  if (!currentUser.SessionId) {
    return alert("You must be in a study session to leave a review.");
  }

  try {
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userNetId: currentUser.UserNetId,
        sessionId: currentUser.SessionId, 
        reviewText: comment, 
        rating,
      }),
    });

    if (!response.ok) throw new Error(await response.text());

    alert("Review submitted successfully!");
    reviewForm.reset();
    fetchReviewsFromBackend(); // Refresh reviews list
  } catch (error) {
    console.error("Error submitting review:", error);
    alert("Failed to submit review.");
  }
}

async function fetchReviewsFromBackend() {
  try {
    // request only the 3 most recent
    const response = await fetch("/api/reviews");
    if (!response.ok) throw new Error("Failed to fetch reviews");

    const { reviews, averageRating } = await response.json();
    const reviewsList = document.getElementById("reviewsList");
    reviewsList.innerHTML = ""; // clear old

    if (reviews.length === 0) {
      reviewsList.innerHTML = "<p>No reviews yet. Be the first!</p>";
      return;
    }

    // render each review
    reviews.forEach((review) => {
      const reviewItem = document.createElement("div");
      reviewItem.classList.add("review-item");
      reviewItem.innerHTML = `
        <p>
          <strong>${review.FirstName || "Anonymous"} ${
        review.LastName || ""
      }</strong>
          (${review.Rating}⭐) 
          <em>— Session:</em> "${review.SessionDescription || "N/A"}"
        </p>
        <p>${review.Comment || "No comment provided."}</p>
        <p><em>${review.sessionReviewCount} review${
        review.sessionReviewCount === 1 ? "" : "s"
      } in this session</em></p>
        <hr>
      `;
      reviewsList.appendChild(reviewItem);
    });

    // render average rating
    const avgDiv = document.createElement("div");
    avgDiv.classList.add("review-average");
    avgDiv.innerHTML = `
      <p><strong>Average Rating (all reviews):</strong> ${averageRating}⭐</p>
    `;
    reviewsList.appendChild(avgDiv);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    const reviewsList = document.getElementById("reviewsList");
    reviewsList.innerHTML = "<p>Could not load reviews at this time.</p>";
  }
}
