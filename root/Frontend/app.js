// Main application logic for StudyLync

// Global variables
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('StudyLync application initialized');
    
    // Check if we have a user in localStorage (simulating authentication)
    const storedUser = localStorage.getItem('studylync_user');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            console.log('Logged in as:', currentUser);
            updateUIForLoggedInUser(currentUser);
        } catch (error) {
            console.error('Error parsing stored user:', error);
        }
    }
    
    // Initialize login form listener if it exists
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Initialize logout button if it exists
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});

// Handle user login (simulated for now)
async function handleLogin(event) {
    if (event) event.preventDefault();
    
    const netIdInput = document.getElementById('netId');
    const passwordInput = document.getElementById('password');
    
    if (!netIdInput || !passwordInput) {
        console.error('Login form inputs not found');
        return;
    }
    
    const netId = netIdInput.value.trim();
    const password = passwordInput.value;
    
    if (!netId || !password) {
        alert('Please enter your NetID and password');
        return;
    }
    
    try {
        // In a real implementation, you would verify credentials with backend
        // For now, just check if user exists
        const response = await fetch(`/api/users/${netId}`);
        
        if (response.ok) {
            const user = await response.json();
            
            // Store user info in localStorage (in a real app, you'd use secure methods)
            currentUser = user;
            localStorage.setItem('studylync_user', JSON.stringify(user));
            
            // Update UI
            updateUIForLoggedInUser(user);
            
            // Hide login modal if it exists
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.style.display = 'none';
            }
        } else {
            // If user doesn't exist and we're in dev mode, create one
            if (netId === 'testuser' && password === 'password') {
                const newUser = {
                    UserNetId: netId,
                    FirstName: 'Test',
                    LastName: 'User',
                    Email: `${netId}@illinois.edu`
                };
                
                // Save to backend
                try {
                    const createResponse = await fetch('/api/users', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(newUser)
                    });
                    
                    if (createResponse.ok) {
                        const createdUser = await createResponse.json();
                        currentUser = createdUser;
                        localStorage.setItem('studylync_user', JSON.stringify(createdUser));
                        updateUIForLoggedInUser(createdUser);
                        
                        // Hide login modal if it exists
                        const loginModal = document.getElementById('loginModal');
                        if (loginModal) {
                            loginModal.style.display = 'none';
                        }
                    } else {
                        alert('Error creating test user');
                    }
                } catch (error) {
                    console.error('Error creating test user:', error);
                    alert('Could not create test user');
                }
            } else {
                alert('Invalid NetID or password');
            }
        }
    } catch (error) {
        console.error('Error logging in:', error);
        alert('Error logging in. Please try again.');
    }
}

// Handle user logout
function handleLogout() {
    // Clear user data
    currentUser = null;
    localStorage.removeItem('studylync_user');
    
    // Update UI
    updateUIForLoggedOutUser();
    
    // Reload page to reset state
    window.location.reload();
}

// Update UI elements based on login state
function updateUIForLoggedInUser(user) {
    // Update nav elements if they exist
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const userDisplay = document.getElementById('userDisplay');
    
    if (loginButton) loginButton.style.display = 'none';
    if (logoutButton) logoutButton.style.display = 'block';
    if (userDisplay) {
        userDisplay.textContent = `${user.FirstName} ${user.LastName}`;
        userDisplay.style.display = 'block';
    }
}

// Update UI elements for logged out state
function updateUIForLoggedOutUser() {
    // Update nav elements if they exist
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const userDisplay = document.getElementById('userDisplay');
    
    if (loginButton) loginButton.style.display = 'block';
    if (logoutButton) logoutButton.style.display = 'none';
    if (userDisplay) userDisplay.style.display = 'none';
}

// Get the current user's NetID (or null if not logged in)
function getCurrentUserNetId() {
    return currentUser ? currentUser.UserNetId : null;
}