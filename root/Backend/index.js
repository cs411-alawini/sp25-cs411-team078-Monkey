// StudyLync Backend Server
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const {
  userQueries,
  courseQueries,
  locationQueries,
  sessionQueries,
  query,
} = require("./db");

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the Frontend directory
app.use(express.static(path.join(__dirname, "../Frontend")));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "StudyLync API is running" });
});

// Course routes
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

// User routes
app.get("/api/users", async (req, res) => {
  try {
    const users = await userQueries.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/api/users/:netId", async (req, res) => {
  try {
    const user = await userQueries.getUserByNetId(req.params.netId);
    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user[0]);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const result = await userQueries.createUser(req.body);
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Location routes
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

app.delete("/api/study-sessions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await sessionQueries.deleteSession(id);
    res.sendStatus(204); // 204 No Content
  } catch (error) {
    console.error("Error deleting study session:", error);
    res.status(500).json({ error: "Failed to delete study session" });
  }
});

// Study session routes
app.get("/api/study-sessions", async (req, res) => {
  try {
    // If course filter is provided, use it
    if (req.query.course) {
      const sessions = await sessionQueries.getSessionsByCourse(
        req.query.course
      );

      // Enhance sessions with participant counts
      const enhancedSessions = await Promise.all(
        sessions.map(async (session) => {
          const participants = await userQueries.getUsersBySessionId(
            session.SessionId
          );
          return {
            ...session,
            participantCount: participants.length,
          };
        })
      );

      return res.json(enhancedSessions);
    }

    // Otherwise get all sessions
    const sessions = await sessionQueries.getAllSessions();

    // Enhance sessions with participant counts
    const enhancedSessions = await Promise.all(
      sessions.map(async (session) => {
        const participants = await userQueries.getUsersBySessionId(
          session.SessionId
        );
        return {
          ...session,
          participantCount: participants.length,
        };
      })
    );

    res.json(enhancedSessions);
  } catch (error) {
    console.error("Error fetching study sessions:", error);
    res.status(500).json({ error: "Failed to fetch study sessions" });
  }
});

app.get("/api/study-sessions/:id", async (req, res) => {
  try {
    const session = await sessionQueries.getSessionById(req.params.id);
    if (session.length === 0) {
      return res.status(404).json({ error: "Study session not found" });
    }

    // Get participants for this session
    const participants = await userQueries.getUsersBySessionId(req.params.id);

    // Add participants to session data
    const sessionWithParticipants = {
      ...session[0],
      participants: participants,
    };

    res.json(sessionWithParticipants);
  } catch (error) {
    console.error("Error fetching study session:", error);
    res.status(500).json({ error: "Failed to fetch study session" });
  }
});

app.post("/api/study-sessions", async (req, res) => {
  try {
    // First check if we need to create a new location
    let locationId = req.body.locationId;

    if (!locationId && req.body.location) {
      // Create a new location if we don't have an ID but do have location data
      const locationResult = await locationQueries.createLocation({
        name: req.body.location.name,
        longitude: req.body.location.longitude,
        latitude: req.body.location.latitude,
        address: req.body.location.address || "N/A",
      });
      locationId = locationResult.insertId;
    }

    // Now create the study session
    const sessionResult = await sessionQueries.createSession({
      courseTitle: req.body.courseTitle,
      locationId: locationId,
      status: req.body.status || "active",
      description: req.body.description || "",
    });

    // Add the creator as a participant
    if (req.body.creatorNetId) {
      await userQueries.updateUserSession(
        req.body.creatorNetId,
        sessionResult.insertId
      );
    }

    // Get the newly created session with full details
    const newSession = await sessionQueries.getSessionById(
      sessionResult.insertId
    );

    res.status(201).json(newSession[0]);
  } catch (error) {
    console.error("Error creating study session:", error);
    res.status(500).json({ error: "Failed to create study session" });
  }
});

app.post("/api/study-sessions/:id/join", async (req, res) => {
  try {
    const { netId } = req.body;

    if (!netId) {
      return res.status(400).json({ error: "User NetID is required" });
    }

    // Update user's session ID
    await userQueries.updateUserSession(netId, req.params.id);

    // Get updated session with participants
    const session = await sessionQueries.getSessionById(req.params.id);
    const participants = await userQueries.getUsersBySessionId(req.params.id);

    res.json({
      ...session[0],
      participants: participants,
    });
  } catch (error) {
    console.error("Error joining study session:", error);
    res.status(500).json({ error: "Failed to join study session" });
  }
});

// Debug route to check database tables
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
    console.error("Error fetching table information:", error);
    res.status(500).json({ error: "Failed to fetch table information" });
  }
});

// DEBUG: Route to check table schema
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

// Catch all other routes and return the index.html file
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../Frontend/index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`StudyLync server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
