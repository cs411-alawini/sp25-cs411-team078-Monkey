// Global variables
let map;
let markers = [];
let userMarker = null;
let studySessions = [];
let courses = [];
const UIUC_CENTER = { lat: 40.1020, lng: -88.2272 }; // UIUC campus coordinates

// Initialize the map
function initializeMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: UIUC_CENTER,
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_RIGHT,
        },
        fullscreenControl: true,
    });

    // Fetch data from the backend
    fetchCoursesFromBackend();
    fetchStudySessionsFromBackend();

    // Set up event listeners
    setupEventListeners();
}

// Fetch study sessions from backend API
async function fetchStudySessionsFromBackend() {
    try {
        const response = await fetch('/api/study-sessions');
        if (!response.ok) {
            throw new Error('Failed to fetch study sessions');
        }
        
        studySessions = await response.json();
        console.log('Fetched study sessions:', studySessions);
        
        // Clear existing markers
        clearMarkers();
        
        // Add markers for each study session
        studySessions.forEach((session) => {
            const location = {
                position: { 
                    lat: parseFloat(session.Latitude), 
                    lng: parseFloat(session.Longitude) 
                },
                title: session.LocationName,
                course: session.CourseTitle,
                courseName: session.CourseName,
                students: session.participantCount || 1,
                sessionId: session.SessionId,
                description: session.Description
            };
            
            addMarker(location);
        });
    } catch (error) {
        console.error('Error fetching study sessions:', error);
        // If API fails, add some sample data for testing
        addSampleStudyGroups();
    }
}

// Fetch courses from backend API
async function fetchCoursesFromBackend() {
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error('Failed to fetch courses');
        }
        
        courses = await response.json();
        console.log('Fetched courses:', courses);
        
        // Populate the course dropdown
        populateCourseDropdown(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
    }
}

// Fallback: Add sample study group markers if backend is not available
function addSampleStudyGroups() {
    const sampleLocations = [
        { 
            position: { lat: 40.1089, lng: -88.2284 }, 
            title: "Grainger Library",
            course: "CS411",
            courseName: "Database Systems",
            students: 3,
            sessionId: 1,
            description: "Working on database project"
        },
        { 
            position: { lat: 40.1030, lng: -88.2302 }, 
            title: "Illini Union", 
            course: "CS225",
            courseName: "Data Structures",
            students: 2,
            sessionId: 2,
            description: "Data structures homework"
        },
        { 
            position: { lat: 40.1133, lng: -88.2244 }, 
            title: "Siebel Center", 
            course: "CS374",
            courseName: "Algorithms & Models of Computation",
            students: 4,
            sessionId: 3,
            description: "Algorithm practice"
        }
    ];

    sampleLocations.forEach((location) => {
        addMarker(location);
    });
}

// Add a marker to the map
function addMarker(location) {
    const marker = new google.maps.Marker({
        position: location.position,
        map: map,
        title: location.title,
        animation: google.maps.Animation.DROP,
    });

    // Create an info window with study group details
    const courseDisplay = location.courseName ? 
        `${location.course} - ${location.courseName}` : 
        location.course;
        
    const contentString = `
        <div class="info-window-content">
            <h3>${location.title}</h3>
            <p><strong>Course:</strong> ${courseDisplay}</p>
            <p><strong>Students:</strong> ${location.students}</p>
            ${location.description ? `<p><strong>Details:</strong> ${location.description}</p>` : ''}
            <button class="join-button" onclick="joinStudyGroup(${location.sessionId || 0}, '${location.title}')">Join Group</button>
        </div>
    `;
    
    const infowindow = new google.maps.InfoWindow({
        content: contentString,
    });

    // Add click event to marker
    marker.addListener("click", () => {
        infowindow.open(map, marker);
    });

    // Store the marker and its metadata
    markers.push({
        marker: marker,
        course: location.course,
        sessionId: location.sessionId,
        infowindow: infowindow,
    });
}

// Clear all markers from the map
function clearMarkers() {
    markers.forEach((m) => {
        m.marker.setMap(null);
    });
    markers = [];
}

// Filter markers based on selected course
function filterMarkersByCourse(course) {
    // If we have a course selected, fetch sessions for that course
    if (course) {
        fetchStudySessionsByCourse(course);
    } else {
        // Otherwise fetch all sessions
        fetchStudySessionsFromBackend();
    }
}

// Fetch study sessions filtered by course
async function fetchStudySessionsByCourse(course) {
    try {
        const response = await fetch(`/api/study-sessions?course=${encodeURIComponent(course)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch study sessions for course');
        }
        
        studySessions = await response.json();
        console.log(`Fetched study sessions for ${course}:`, studySessions);
        
        // Clear existing markers
        clearMarkers();
        
        // Add markers for each study session
        studySessions.forEach((session) => {
            const location = {
                position: { 
                    lat: parseFloat(session.Latitude), 
                    lng: parseFloat(session.Longitude) 
                },
                title: session.LocationName,
                course: session.CourseTitle,
                courseName: session.CourseName,
                students: session.participantCount || 1,
                sessionId: session.SessionId,
                description: session.Description
            };
            
            addMarker(location);
        });
    } catch (error) {
        console.error(`Error fetching study sessions for ${course}:`, error);
    }
}

// Populate the course dropdown with data from backend
function populateCourseDropdown(courses) {
    const dropdown = document.getElementById('courseFilter');
    dropdown.innerHTML = '<option value="">All Courses</option>';
    
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.CourseTitle;
        
        // Use CourseName if available, otherwise just CourseTitle
        const displayText = course.CourseName ? 
            `${course.CourseTitle} - ${course.CourseName}` : 
            course.CourseTitle;
            
        option.textContent = displayText;
        dropdown.appendChild(option);
    });
}

// Drop a pin at user's current location
function dropPinAtCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                // Remove previous user marker if exists
                if (userMarker) {
                    userMarker.setMap(null);
                }

                // Add marker at user's location
                userMarker = new google.maps.Marker({
                    position: userPosition,
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: "#4285F4",
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "#FFFFFF",
                    },
                    title: "Your Location",
                });

                // Center map on user's location
                map.setCenter(userPosition);
                
                // Show a dialog to input study details
                showCreateStudyGroupDialog(userPosition);
            },
            (error) => {
                console.error("Error getting user location:", error);
                alert("Unable to get your location. Please check your browser settings.");
            }
        );
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// Show dialog to create a study group 
function showCreateStudyGroupDialog(position) {
    // Get a list of courses for the dropdown
    let courseOptions = '';
    courses.forEach(course => {
        courseOptions += `<option value="${course.CourseTitle}">${course.CourseTitle}</option>`;
    });
    
    // Create a more user-friendly dialog
    const locationName = prompt("Enter a name for this location:", "");
    if (!locationName) return;
    
    const courseTitle = prompt("Enter the course code you're studying (e.g., CS411):", "");
    if (!courseTitle) return;
    
    const description = prompt("Enter a brief description of your study session:", "");
    
    // Create study session data
    const sessionData = {
        location: {
            name: locationName,
            latitude: position.lat,
            longitude: position.lng
        },
        courseTitle: courseTitle,
        description: description,
        status: 'active',
        // In a real implementation, you would get the current user's NetID
        creatorNetId: 'user123' 
    };
    
    // Send to backend
    createStudySession(sessionData, position);
}

// Create study session in backend
async function createStudySession(sessionData, position) {
    try {
        const response = await fetch('/api/study-sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to create study session');
        }
        
        const newSession = await response.json();
        console.log('Created new study session:', newSession);
        
        // If backend call succeeds, refresh study sessions
        fetchStudySessionsFromBackend();
        
    } catch (error) {
        console.error('Error creating study session:', error);
        
        // If backend call fails, create a temporary marker
        const newStudyGroup = {
            position: position,
            title: sessionData.location.name,
            course: sessionData.courseTitle,
            students: 1,
            description: sessionData.description
        };
        addMarker(newStudyGroup);
    }
}

// Join study group function
async function joinStudyGroup(sessionId, locationName) {
    // Check if we have a sessionId (if using sample data, we might not)
    if (!sessionId) {
        alert(`You've joined the study group at ${locationName}!`);
        return;
    }
    
    try {
        // In a real implementation, you would get the current user's NetID
        const userNetId = 'user123'; 
        
        const response = await fetch(`/api/study-sessions/${sessionId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ netId: userNetId })
        });
        
        if (!response.ok) {
            throw new Error('Failed to join study session');
        }
        
        const updatedSession = await response.json();
        console.log('Joined study session:', updatedSession);
        
        alert(`You've successfully joined the study group at ${locationName}!`);
        
        // Refresh the study sessions to update the marker info
        fetchStudySessionsFromBackend();
        
    } catch (error) {
        console.error('Error joining study session:', error);
        alert(`There was an error joining the study group. Please try again.`);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Course filter
    document.getElementById("courseFilter").addEventListener("change", function() {
        filterMarkersByCourse(this.value);
    });

    // Drop pin button
    document.getElementById("dropPin").addEventListener("click", dropPinAtCurrentLocation);
    
    // Add a refresh button event listener if it exists
    const refreshButton = document.getElementById("refreshMap");
    if (refreshButton) {
        refreshButton.addEventListener("click", fetchStudySessionsFromBackend);
    }
}