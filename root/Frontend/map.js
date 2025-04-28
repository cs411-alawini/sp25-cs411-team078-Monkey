// Global variables
let map;
let markers = [];
let userMarker = null;
let studySessions = [];
let courses = [];
const UIUC_CENTER = { lat: 40.1020, lng: -88.2272 }; // UIUC campus coordinates

// Initialize the map
function initializeMap() {
    console.log("HELLOOOOO")
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

    fetchCoursesFromBackend();
    fetchStudySessionsFromBackend();

    setupEventListeners();
    setupAutocomplete();

}

// fetch study sessions from backend API
async function fetchStudySessionsFromBackend() {
    try {
        const response = await fetch('/api/study-sessions');
        if (!response.ok) {
            throw new Error('Failed to fetch study sessions');
        }
        
        studySessions = await response.json();
        console.log('Fetched study sessions:', studySessions);
        
        clearMarkers();
        
        // add markers for each study session
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
        //populateCourseDropdown(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
    }
}

// fallback: sample study group markers if backend is not available
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

// add a marker to the map
function addMarker(location) {
    const marker = new google.maps.Marker({
        position: location.position,
        map: map,
        title: location.title,
        animation: google.maps.Animation.DROP,
    });

    // create an info window with study group details
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

function clearMarkers() {
    markers.forEach((m) => {
        m.marker.setMap(null);
    });
    markers = [];
}

function filterMarkersByCourse(course) {
    if (course) {
        fetchStudySessionsByCourse(course);
    } else {
        fetchStudySessionsFromBackend();
    }
}

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

// pop the course dropdown with data from backend
function populateCourseDropdown(courses) {
    const dropdown = document.getElementById('courseFilter');
    dropdown.innerHTML = '<option value="">All Courses</option>';
    
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.CourseTitle;
        
        // use CourseName if available, otherwise just CourseTitle
        const displayText = course.CourseName ? 
            `${course.CourseTitle} - ${course.CourseName}` : 
            course.CourseTitle;
            
        option.textContent = displayText;
        dropdown.appendChild(option);
    });
}

// drop a pin at user's current location
function dropPinAtCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };

                if (userMarker) {
                    userMarker.setMap(null);
                }

                // add marker at user's location
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

function showCreateStudyGroupDialog(position) {
    // Get a list of courses for the dropdown
    let courseOptions = '';
    courses.forEach(course => {
        courseOptions += `<option value="${course.CourseTitle}">${course.CourseTitle}</option>`;
    });
    
    const locationName = prompt("Enter a name for this location:", "");
    if (!locationName) return;
    
    const courseTitle = prompt("Enter the course code you're studying (e.g., CS411):", "");
    if (!courseTitle) return;
    
    const description = prompt("Enter a brief description of your study session:", "");
    
    // create study session data
    const sessionData = {
        location: {
            name: locationName,
            latitude: position.lat,
            longitude: position.lng
        },
        courseTitle: courseTitle,
        description: description,
        status: 'active',
        creatorNetId: 'user123' 
    };
    
    // Send to backend
    createStudySession(sessionData, position);
}

// create study session in backend
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
        
        // if backend call succeeds, refresh study sessions
        fetchStudySessionsFromBackend();
        
    } catch (error) {
        console.error('Error creating study session:', error);
        
        // If backend call fails create a temporary marker
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
// Join study group function
async function joinStudyGroup(sessionId, locationName) {
    if (!sessionId) {
        alert(`Invalid session. Please try again.`);
        return;
    }
    
    // Check if user is signed in
    if (!currentUser) {
        alert('You must be signed in to join a study group.');
        return;
    }
    
    try {
        const userNetId = currentUser.UserNetId; // ✅ Use logged-in user's NetID
        
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
    // document.getElementById("courseFilter").addEventListener("input", function() {
    //     const course = this.value.trim();
    //     if (course === "") {
    //         fetchStudySessionsFromBackend(); // no filter if empty
    //     } else {
    //         filterMarkersByCourse(course); // filter normally
    //     }
    // });
    

    // Drop pin button
    document.getElementById("dropPin").addEventListener("click", dropPinAtCurrentLocation);
    
    const refreshButton = document.getElementById("refreshMap");
    if (refreshButton) {
        refreshButton.addEventListener("click", fetchStudySessionsFromBackend);
    }
}

function setupAutocomplete() {
    const courseInput = document.getElementById('courseFilter');
    const autocompleteList = document.getElementById('autocompleteList');

    courseInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        autocompleteList.innerHTML = '';

        if (!query) {
            fetchStudySessionsFromBackend();
            return;
        }

        const matchedCourses = courses
            .filter(course => course.CourseTitle.toLowerCase().includes(query))
            .slice(0, 10); // limit to 10 suggestions

        matchedCourses.forEach(course => {
            const item = document.createElement('div');
            item.classList.add('autocomplete-item');
            item.innerText = course.CourseTitle;
            item.addEventListener('click', function() {
                courseInput.value = course.CourseTitle;
                autocompleteList.innerHTML = '';
                filterMarkersByCourse(course.CourseTitle);
            });
            autocompleteList.appendChild(item);
        });
    });

    // Handle "Enter" key
    courseInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = this.value.trim();
            autocompleteList.innerHTML = '';
            if (query === '') {
                fetchStudySessionsFromBackend();
            } else {
                filterMarkersByCourse(query);
            }
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.autocomplete-container')) {
            autocompleteList.innerHTML = '';
        }
    });
}
