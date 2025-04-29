// Database connection setup for StudyLync MySQL on GCP
const mysql = require("mysql2/promise");
require("dotenv").config();

// Configuration for MySQL connection
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl:
    process.env.DB_SSL === "true"
      ? {
          rejectUnauthorized: false,
        }
      : false,
  connectTimeout: 10000,
  keepAliveInitialDelay: 10000,
};

console.log("Connecting to database with config:", {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port,
  ssl: !!dbConfig.ssl,
});

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Test the connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Successfully connected to MySQL database on GCP");
    const [result] = await connection.execute("SELECT 1 as test");
    console.log("Database query test successful:", result);
    connection.release();
    return true;
  } catch (error) {
    console.error("Error connecting to MySQL database:", error);
    return false;
  }
}

// Utility function to execute non-transactional queries
async function query(sql, params = []) {
  try {
    console.log(
      `Executing SQL: ${sql.substring(0, 150)}${sql.length > 150 ? "..." : ""}`
    );
    if (params.length > 0) {
      console.log("With parameters:", params);
    }
    const [results] = await pool.execute(sql, params);
    console.log(
      `Query successful, returned ${results ? results.length : 0} rows`
    );
    return results;
  } catch (error) {
    console.error("Database query error:", error);
    console.error("Failed query:", sql);
    console.error("Query parameters:", params);
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.beginTransaction();
    await callback(connection);
    await connection.commit();
    console.log("Transaction committed successfully");
  } catch (error) {
    await connection.rollback();
    console.error("Transaction rolled back due to error:", error);
    throw error;
  } finally {
    connection.release();
  }
}

// User-related database operations
const userQueries = {
  // fetch one user by NetID
  getUserByNetId: async (netId) => {
    const rows = await query(
      "SELECT UserNetId, FirstName, LastName, Email, Password FROM Users WHERE UserNetId = ?",
      [netId]
    );
    return rows[0] || null;
  },

  // create a new user, then re-fetch it
  createUser: async (userData) => {
    const { UserNetId, FirstName, LastName, Email, Password } = userData;
    await query(
      "INSERT INTO Users (UserNetId, FirstName, LastName, Email, Password) VALUES (?, ?, ?, ?, ?)",
      [UserNetId, FirstName, LastName, Email, Password]
    );
    return userQueries.getUserByNetId(UserNetId);
  },

  // get all users in a given session
  getUsersBySessionId: async (sessionId) => {
    return await query(
      "SELECT UserNetId, FirstName, LastName, Email, SessionId FROM Users WHERE SessionId = ?",
      [sessionId]
    );
  },

  // assign a user to a session
  updateUserSession: async (netId, sessionId) => {
    return await query("UPDATE Users SET SessionId = ? WHERE UserNetId = ?", [
      sessionId,
      netId,
    ]);
  },
};

// Course-related database operations
const courseQueries = {
  getAllCourses: async () => await query("SELECT * FROM Courses"),

  getCourseByTitle: async (title) =>
    await query("SELECT * FROM Courses WHERE CourseTitle = ?", [title]),
};

// Location-related database operations
const locationQueries = {
  getAllLocations: async () => await query("SELECT * FROM Locations"),

  getLocationById: async (id) =>
    await query("SELECT * FROM Locations WHERE LocationId = ?", [id]),

  createLocation: async (locationData) => {
    const { name, longitude, latitude, address } = locationData;
    console.log("Creating location with data:", {
      name,
      longitude,
      latitude,
      address,
    });
    return await query(
      "INSERT INTO Locations (LocationName, Longitude, Latitude, Address) VALUES (?, ?, ?, ?)",
      [name, longitude, latitude, address || ""]
    );
  },
};

// Study session-related database operations
const sessionQueries = {
  getTopCoursesByAttendance: async () => {
    return await query(`
      SELECT 
        s.CourseTitle,
        COUNT(u.UserNetId) AS StudentCount
      FROM 
        StudySessions s
      LEFT JOIN 
        Users u ON s.SessionId = u.SessionId
      GROUP BY 
        s.CourseTitle
      ORDER BY 
        StudentCount DESC
      LIMIT 3
    `);
  },

  getAllSessions: async () => {
    const basicTest = await query(
      "SELECT COUNT(*) as count FROM StudySessions"
    );
    console.log("StudySessions count:", basicTest[0].count);
    return await query(`
      SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
      FROM StudySessions s
      LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
      LEFT JOIN Locations l ON s.LocationId = l.LocationId
    `);
  },

  getSessionById: async (id) =>
    await query(
      `
    SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
    FROM StudySessions s
    LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
    LEFT JOIN Locations l ON s.LocationId = l.LocationId
    WHERE s.SessionId = ?
  `,
      [id]
    ),

  getSessionsByCourse: async (courseTitle) =>
    await query(
      `
    SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
    FROM StudySessions s
    LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
    LEFT JOIN Locations l ON s.LocationId = l.LocationId
    WHERE c.CourseTitle = ?
  `,
      [courseTitle]
    ),

  createStudySession: async (sessionData) => {
    const { courseTitle, locationId, status, description } = sessionData;
    console.log("Creating session with data:", {
      courseTitle,
      locationId,
      status,
      description,
    });

    const courseCheck = await query(
      "SELECT COUNT(*) as count FROM Courses WHERE CourseTitle = ?",
      [courseTitle]
    );
    if (courseCheck[0].count === 0) {
      throw new Error(`Course ${courseTitle} does not exist`);
    }

    const locationCheck = await query(
      "SELECT COUNT(*) as count FROM Locations WHERE LocationId = ?",
      [locationId]
    );
    if (locationCheck[0].count === 0) {
      throw new Error(`Location ${locationId} does not exist`);
    }

    return await query(
      "INSERT INTO StudySessions (CourseTitle, LocationId, Status, Description) VALUES (?, ?, ?, ?)",
      [courseTitle, locationId, status, description]
    );
  },

  getSessionParticipants: async (sessionId) =>
    await query("SELECT * FROM Users WHERE SessionId = ?", [sessionId]),

  addUserToSession: async (netId, sessionId) =>
    await transaction(async (conn) => {
      const [user] = await conn.execute(
        "SELECT SessionId FROM Users WHERE UserNetId = ?",
        [netId]
      );

      if (user.length === 0) {
        throw new Error("User not found");
      }

      if (user[0].SessionId) {
        throw new Error("User already in another session");
      }

      await conn.execute("UPDATE Users SET SessionId = ? WHERE UserNetId = ?", [
        sessionId,
        netId,
      ]);
    }),
};

// Initialize database connection
testConnection();

// Verify tables
async function verifyDatabaseSetup() {
  try {
    console.log("Verifying database tables...");
    const tables = ["Users", "Courses", "Locations", "StudySessions"];
    for (const table of tables) {
      const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`Table ${table} exists with ${result[0].count} rows`);
    }
    console.log("Database verification complete");
  } catch (error) {
    console.error("Error verifying database setup:", error);
  }
}

//stored procedure #1
async function createStudySessionAndAssignUser(
  courseTitle,
  locationId,
  status,
  description,
  userNetId
) {
  const sql = "CALL CreateStudySessionAndAssignUser(?, ?, ?, ?, ?)";
  const params = [courseTitle, locationId, status, description, userNetId];
  return await query(sql, params);
}

//stored #2
async function getSessionDetailsWithParticipants(sessionId) {
  const sql = "CALL GetSessionDetailsWithParticipants(?)";
  const params = [sessionId];
  const results = await query(sql, params);

  // Stored procedures in MySQL return results as [ [rows], [metadata] ]
  return results[0];
}
setTimeout(verifyDatabaseSetup, 1000);

const reviewQueries = {
  createReview: async ({ userNetId, rating, comment }) => {
    return await query(
      "INSERT INTO Reviews (UserNetId, Rating, Comment) VALUES (?, ?, ?)",
      [userNetId, rating, comment]
    );
  },

  getAllReviews: async () => {
    return await query(`
      SELECT Reviews.*, Users.FirstName, Users.LastName
      FROM Reviews
      LEFT JOIN Users ON Reviews.UserNetId = Users.UserNetId
      ORDER BY CreatedAt DESC
    `);
  },

  getRecentReviewsWithSession: async () =>
    await query(
      `
    SELECT
        r.ReviewId,
        r.SessionId,
        r.Comment,
        r.Rating,
        r.CreatedAt,
        u.FirstName,
        u.LastName,
        s.Description          AS SessionDescription,
        COUNT(r2.ReviewId)     AS sessionReviewCount
      FROM Reviews r
      LEFT JOIN Users u
        ON r.UserNetId = u.UserNetId               -- join #1
      LEFT JOIN StudySessions s
        ON r.SessionId = s.SessionId               -- join #2
      LEFT JOIN Reviews r2
        ON r2.SessionId = r.SessionId              -- self-join for aggregation
      GROUP BY
        r.ReviewId,
        r.SessionId,
        r.Comment,
        r.Rating,
        r.CreatedAt,
        u.FirstName,
        u.LastName,
        s.Description
      ORDER BY
        r.CreatedAt DESC
      LIMIT 3
    `
    ),

  getAverageRating: async () =>
    await query(`SELECT ROUND(AVG(Rating),2) AS averageRating FROM Reviews`),
};

module.exports = {
  query,
  transaction,
  userQueries,
  courseQueries,
  locationQueries,
  sessionQueries,
  reviewQueries,
  createStudySessionAndAssignUser,
  getSessionDetailsWithParticipants,
  testConnection,
  verifyDatabaseSetup,
};
