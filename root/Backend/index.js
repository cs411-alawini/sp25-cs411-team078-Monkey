//  Backend Server
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const {
  userQueries,
  courseQueries,
  locationQueries,
  sessionQueries,
  reviewQueries,
  query,
  createStudySessionAndAssignUser,
  getSessionDetailsWithParticipants,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../Frontend")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "StudyLync API is running" });
});

// Courses
app.get("/api/courses", async (req, res) => {
  try {
    const courses = await courseQueries.getAllCourses();
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

app.get("/api/courses/:title", async (req, res) => {
  try {
    const course = await courseQueries.getCourseByTitle(req.params.title);
    if (course.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(course[0]);
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ error: "Failed to fetch course" });
  }
});

// Users
app.post("/api/users", async (req, res) => {
  const { UserNetId, FirstName, LastName, Email, Password } = req.body;
  if (!UserNetId || !FirstName || !LastName || !Email || !Password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const newUser = await userQueries.createUser({
      UserNetId,
      FirstName,
      LastName,
      Email,
      Password,
    });
    return res.status(201).json(newUser);
  } catch (err) {
    console.error("POST /api/users error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "NetID already taken" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/users/:netId", async (req, res) => {
  const { netId } = req.params;
  try {
    const user = await userQueries.getUserByNetId(netId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("GET /api/users/:netId error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Locations
app.get("/api/locations", async (req, res) => {
  try {
    const locations = await locationQueries.getAllLocations();
    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

app.post("/api/locations", async (req, res) => {
  try {
    const result = await locationQueries.createLocation(req.body);
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error) {
    console.error("Error creating location:", error);
    res.status(500).json({ error: "Failed to create location" });
  }
});

//  GET top courses by attendance 
app.get("/api/top-courses", async (req, res) => {
  try {
    const topCourses = await sessionQueries.getTopCoursesByAttendance();
    res.json(topCourses);
  } catch (error) {
    console.error("Error fetching top courses:", error);
    res.status(500).json({ error: "Failed to fetch top courses" });
  }
});

// Study Sessions

//  GET all study sessions 
app.get("/api/study-sessions", async (req, res) => {
  try {
    let sessions;
    if (req.query.course) {
      sessions = await sessionQueries.getSessionsByCourse(req.query.course);
    } else {
      sessions = await sessionQueries.getAllSessions();
    }

    // Add participant counts
    const enhancedSessions = await Promise.all(
      sessions.map(async (session) => {
        const participants = await userQueries.getUsersBySessionId(
          session.SessionId
        );
        return { ...session, participantCount: participants.length };
      })
    );

    res.json(enhancedSessions);
  } catch (error) {
    console.error("Error fetching study sessions:", error);
    res.status(500).json({ error: "Failed to fetch study sessions" });
  }
});

//  GET one study session with participants (stored procedure) 
app.get("/api/study-sessions/:id", async (req, res) => {
  try {
    const sessionDetails = await getSessionDetailsWithParticipants(
      req.params.id
    );

    if (sessionDetails.length === 0) {
      return res.status(404).json({ error: "Study session not found" });
    }

    res.json(sessionDetails[0]);
  } catch (error) {
    console.error("Error fetching study session:", error);
    res.status(500).json({ error: "Failed to fetch study session" });
  }
});

// --- POST create new study session (stored procedure) ---
app.post("/api/study-sessions", async (req, res) => {
  try {
    let locationId = req.body.locationId;

    // create location if needed
    if (!locationId && req.body.location) {
      const locationResult = await locationQueries.createLocation({
        name: req.body.location.name,
        longitude: req.body.location.longitude,
        latitude: req.body.location.latitude,
        address: req.body.location.address || "N/A",
      });
      locationId = locationResult.insertId;
    }

    if (!req.body.creatorNetId) {
      return res.status(400).json({ error: "Creator NetId is required" });
    }

    // create the study session
    await sessionQueries.createStudySession({
      courseTitle: req.body.courseTitle,
      locationId: locationId,
      status: req.body.status || "active",
      description: req.body.description || "",
    });

    // get  newly created session
    const sessions = await sessionQueries.getAllSessions();
    const newSession = sessions[sessions.length - 1];
    const newSessionId = newSession.SessionId;

    // update the creator's SessionId
    await userQueries.updateUserSession(req.body.creatorNetId, newSessionId);

    res.status(201).json(newSession);
  } catch (error) {
    console.error("Error creating study session:", error);
    res.status(500).json({ error: "Failed to create study session" });
  }
});

// --- POST join an existing study session ---
app.post("/api/study-sessions/:id/join", async (req, res) => {
  try {
    const { netId } = req.body;
    if (!netId) {
      return res.status(400).json({ error: "User NetID is required" });
    }

    await userQueries.updateUserSession(netId, req.params.id);

    const session = await sessionQueries.getSessionById(req.params.id);
    const participants = await userQueries.getUsersBySessionId(req.params.id);

    res.json({ ...session[0], participants });
  } catch (error) {
    console.error("Error joining study session:", error);
    res.status(500).json({ error: "Failed to join study session" });
  }
});

//  DELETE a study session 
app.delete("/api/delete-session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    console.log(
      `🛑 DELETE requested for StudySession with SessionId: ${sessionId}`
    );

    // Confirm session exists
    const session = await sessionQueries.getSessionById(sessionId);
    if (!session || session.length === 0) {
      console.warn(`⚠️ Session ${sessionId} not found, cannot delete.`);
      return res.status(404).json({ error: "Session not found" });
    }

    console.log(`✅ Deleting Session ${sessionId}...`);

    // Delete the session
    await query("DELETE FROM StudySessions WHERE SessionId = ?", [sessionId]);

    console.log(`✅ Session ${sessionId} deleted successfully.`);

    // AfterDeleteStudySession trigger will fire automatically to clear user SessionIds!
    res.status(200).json({ message: "Session deleted successfully." });
  } catch (error) {
    console.error(`❌ Error deleting session ${sessionId}:`, error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Debug
app.get("/api/debug/tables", async (req, res) => {
  try {
    const tables = await query(
      `
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
    `,
      [process.env.DB_NAME]
    );

    res.json({ tables: tables.map((t) => t.TABLE_NAME) });
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});

app.get("/api/debug/schema/:table", async (req, res) => {
  try {
    const columns = await query(
      `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `,
      [process.env.DB_NAME, req.params.table]
    );

    res.json({ columns });
  } catch (error) {
    console.error(`Error fetching schema for ${req.params.table}:`, error);
    res
      .status(500)
      .json({ error: `Failed to fetch schema for ${req.params.table}` });
  }
});

//  POST create a new review 
app.post("/api/reviews", async (req, res) => {
  const { userNetId, sessionId, reviewText, rating } = req.body;

  if (!userNetId || !sessionId || !reviewText || rating == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await query(
      `INSERT INTO Reviews (UserNetId, SessionId, Comment, Rating)
       VALUES (?, ?, ?, ?)`,
      [userNetId, sessionId, reviewText, rating]
    );

    res.status(201).json({
      message: "Review submitted successfully",
      reviewId: result.insertId,
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

//  GET fetch all reviews 
app.get("/api/reviews", async (req, res) => {
  try {
    // fetch the 3 most recent reviews 
    const reviews = await reviewQueries.getRecentReviewsWithSession();

    //  fetch overall average
    const [avgRow] = await reviewQueries.getAverageRating();
    const averageRating = avgRow ? avgRow.averageRating : null;

    //  ship both down
    res.json({ reviews, averageRating });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// serve index.html for anything else
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../Frontend/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`StudyLync server is running on port ${PORT}`);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
