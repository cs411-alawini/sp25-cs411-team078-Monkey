// Database connection setup for StudyLync MySQL on GCP
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration for MySQL connection
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  connectTimeout: 10000,
  keepAliveInitialDelay: 10000
};

console.log('Connecting to database with config:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port,
  ssl: !!dbConfig.ssl
});

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Test the connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database on GCP');
    const [result] = await connection.execute('SELECT 1 as test');
    console.log('Database query test successful:', result);
    connection.release();
    return true;
  } catch (error) {
    console.error('Error connecting to MySQL database:', error);
    return false;
  }
}

// Utility function to execute non-transactional queries
async function query(sql, params = []) {
  try {
    console.log(`Executing SQL: ${sql.substring(0, 150)}${sql.length > 150 ? '...' : ''}`);
    if (params.length > 0) {
      console.log('With parameters:', params);
    }
    const [results] = await pool.execute(sql, params);
    console.log(`Query successful, returned ${results ? results.length : 0} rows`);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('Failed query:', sql);
    console.error('Query parameters:', params);
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction();
    await callback(connection);
    await connection.commit();
    console.log('Transaction committed successfully');
  } catch (error) {
    await connection.rollback();
    console.error('Transaction rolled back due to error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// User-related database operations
const userQueries = {
  getAllUsers: async () => await query('SELECT * FROM Users'),

  getUserByNetId: async (netId) => await query('SELECT * FROM Users WHERE UserNetId = ?', [netId]),

  getUsersBySessionId: async (sessionId) => await query('SELECT * FROM Users WHERE SessionId = ?', [sessionId]),

  createUser: async (userData) => {
    const { netId, firstName, lastName, email, password } = userData;
    return await query(
      'INSERT INTO Users (UserNetId, FirstName, LastName, Email, Password) VALUES (?, ?, ?, ?, ?)',
      [netId, firstName, lastName, email, password]
    );
  },

  updateUserSession: async (netId, sessionId) => await query(
    'UPDATE Users SET SessionId = ? WHERE UserNetId = ?',
    [sessionId, netId]
  )
};

// Course-related database operations
const courseQueries = {
  getAllCourses: async () => await query('SELECT * FROM Courses'),

  getCourseByTitle: async (title) => await query('SELECT * FROM Courses WHERE CourseTitle = ?', [title])
};

// Location-related database operations
const locationQueries = {
  getAllLocations: async () => await query('SELECT * FROM Locations'),

  getLocationById: async (id) => await query('SELECT * FROM Locations WHERE LocationId = ?', [id]),

  createLocation: async (locationData) => {
    const { name, longitude, latitude, address } = locationData;
    console.log('Creating location with data:', { name, longitude, latitude, address });
    return await query(
      'INSERT INTO Locations (LocationName, Longitude, Latitude, Address) VALUES (?, ?, ?, ?)',
      [name, longitude, latitude, address || '']
    );
  }
};

// Study session-related database operations
const sessionQueries = {
  getAllSessions: async () => {
    const basicTest = await query('SELECT COUNT(*) as count FROM StudySessions');
    console.log('StudySessions count:', basicTest[0].count);
    return await query(`
      SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
      FROM StudySessions s
      LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
      LEFT JOIN Locations l ON s.LocationId = l.LocationId
    `);
  },

  getSessionById: async (id) => await query(`
    SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
    FROM StudySessions s
    LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
    LEFT JOIN Locations l ON s.LocationId = l.LocationId
    WHERE s.SessionId = ?
  `, [id]),

  getSessionsByCourse: async (courseTitle) => await query(`
    SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
    FROM StudySessions s
    LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
    LEFT JOIN Locations l ON s.LocationId = l.LocationId
    WHERE c.CourseTitle = ?
  `, [courseTitle]),

  createSession: async (sessionData) => {
    const { courseTitle, locationId, status, description } = sessionData;
    console.log('Creating session with data:', { courseTitle, locationId, status, description });

    const courseCheck = await query('SELECT COUNT(*) as count FROM Courses WHERE CourseTitle = ?', [courseTitle]);
    if (courseCheck[0].count === 0) {
      throw new Error(`Course ${courseTitle} does not exist`);
    }

    const locationCheck = await query('SELECT COUNT(*) as count FROM Locations WHERE LocationId = ?', [locationId]);
    if (locationCheck[0].count === 0) {
      throw new Error(`Location ${locationId} does not exist`);
    }

    return await query(
      'INSERT INTO StudySessions (CourseTitle, LocationId, Status, Description) VALUES (?, ?, ?, ?)',
      [courseTitle, locationId, status, description]
    );
  },

  getSessionParticipants: async (sessionId) => await query('SELECT * FROM Users WHERE SessionId = ?', [sessionId]),

  addUserToSession: async (netId, sessionId) => await transaction(async (conn) => {
    const [user] = await conn.execute('SELECT SessionId FROM Users WHERE UserNetId = ?', [netId]);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    if (user[0].SessionId) {
      throw new Error('User already in another session');
    }

    await conn.execute('UPDATE Users SET SessionId = ? WHERE UserNetId = ?', [sessionId, netId]);
  })
};

// Initialize database connection
testConnection();

// Verify tables
async function verifyDatabaseSetup() {
  try {
    console.log('Verifying database tables...');
    const tables = ['Users', 'Courses', 'Locations', 'StudySessions'];
    for (const table of tables) {
      const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`Table ${table} exists with ${result[0].count} rows`);
    }
    console.log('Database verification complete');
  } catch (error) {
    console.error('Error verifying database setup:', error);
  }
}

setTimeout(verifyDatabaseSetup, 1000);

module.exports = {
  query,
  transaction,
  userQueries,
  courseQueries,
  locationQueries,
  sessionQueries,
  testConnection,
  verifyDatabaseSetup
};

// // Database connection setup for StudyLync MySQL on GCP
// const mysql = require('mysql2/promise');
// require('dotenv').config();

// // Configuration for MySQL connection
// const dbConfig = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT || 3306,
//   ssl: process.env.DB_SSL === 'true' ? {
//     rejectUnauthorized: false
//   } : false,
//   // Add connection timeout
//   connectTimeout: 10000,
//   // Enable keep-alive
//   keepAliveInitialDelay: 10000
// };

// // Display connection info (without sensitive data)
// console.log('Connecting to database with config:', {
//   host: dbConfig.host,
//   user: dbConfig.user,
//   database: dbConfig.database,
//   port: dbConfig.port,
//   ssl: !!dbConfig.ssl
// });

// // Create a connection pool
// const pool = mysql.createPool(dbConfig);

// // Test the connection
// async function testConnection() {
//   try {
//     const connection = await pool.getConnection();
//     console.log('Successfully connected to MySQL database on GCP');
    
//     // Test basic query to verify database access
//     const [result] = await connection.execute('SELECT 1 as test');
//     console.log('Database query test successful:', result);
    
//     connection.release();
//     return true;
//   } catch (error) {
//     console.error('Error connecting to MySQL database:', error);
//     console.error('Check your .env file and make sure DB_NAME matches your actual database name');
//     return false;
//   }
// }

// // Utility function to execute queries with better error handling
// async function query(sql, params = []) {
//   try {
//     console.log(`Executing SQL: ${sql.substring(0, 150)}${sql.length > 150 ? '...' : ''}`);
//     if (params && params.length > 0) {
//       console.log('With parameters:', params);
//     }
    
//     const [results] = await pool.execute(sql, params);
//     console.log(`Query successful, returned ${results ? results.length : 0} rows`);
//     return results;
//   } catch (error) {
//     console.error('Database query error:', error);
//     console.error('Failed query:', sql);
//     console.error('Query parameters:', params);
//     throw error;
//   }
// }

// // User-related database operations
// const userQueries = {
//   getAllUsers: async () => {
//     try {
//       return await query('SELECT * FROM Users');
//     } catch (error) {
//       console.error('Error in getAllUsers:', error);
//       throw error;
//     }
//   },
  
//   getUserByNetId: async (netId) => {
//     try {
//       return await query('SELECT * FROM Users WHERE UserNetId = ?', [netId]);
//     } catch (error) {
//       console.error(`Error in getUserByNetId for ${netId}:`, error);
//       throw error;
//     }
//   },
  
//   getUsersBySessionId: async (sessionId) => {
//     try {
//       return await query('SELECT * FROM Users WHERE SessionId = ?', [sessionId]);
//     } catch (error) {
//       console.error(`Error in getUsersBySessionId for session ${sessionId}:`, error);
//       throw error;
//     }
//   },
  
//   createUser: async (userData) => {
//     try {
//       const { netId, firstName, lastName, email, password } = userData;
//       return await query(
//         'INSERT INTO Users (UserNetId, FirstName, LastName, Email, Password) VALUES (?, ?, ?, ?, ?)',
//         [netId, firstName, lastName, email, password]
//       );
//     } catch (error) {
//       console.error('Error in createUser:', error);
//       throw error;
//     }
//   },
  
//   updateUserSession: async (netId, sessionId) => {
//     try {
//       return await query(
//         'UPDATE Users SET SessionId = ? WHERE UserNetId = ?',
//         [sessionId, netId]
//       );
//     } catch (error) {
//       console.error(`Error in updateUserSession for user ${netId}, session ${sessionId}:`, error);
//       throw error;
//     }
//   }
// };

// // Course-related database operations
// const courseQueries = {
//   getAllCourses: async () => {
//     try {
//       return await query('SELECT * FROM Courses');
//     } catch (error) {
//       console.error('Error in getAllCourses:', error);
//       throw error;
//     }
//   },
  
//   getCourseByTitle: async (title) => {
//     try {
//       return await query('SELECT * FROM Courses WHERE CourseTitle = ?', [title]);
//     } catch (error) {
//       console.error(`Error in getCourseByTitle for ${title}:`, error);
//       throw error;
//     }
//   }
// };

// // Location-related database operations
// const locationQueries = {
//   getAllLocations: async () => {
//     try {
//       return await query('SELECT * FROM Locations');
//     } catch (error) {
//       console.error('Error in getAllLocations:', error);
//       throw error;
//     }
//   },
  
//   getLocationById: async (id) => {
//     try {
//       return await query('SELECT * FROM Locations WHERE LocationId = ?', [id]);
//     } catch (error) {
//       console.error(`Error in getLocationById for ${id}:`, error);
//       throw error;
//     }
//   },
  
//   createLocation: async (locationData) => {
//     try {
//       const { name, longitude, latitude, address } = locationData;
//       console.log('Creating location with data:', { name, longitude, latitude, address });
//       return await query(
//         'INSERT INTO Locations (LocationName, Longitude, Latitude, Address) VALUES (?, ?, ?, ?)',
//         [name, longitude, latitude, address || '']
//       );
//     } catch (error) {
//       console.error('Error in createLocation:', error);
//       throw error;
//     }
//   }
// };

// // Study session-related database operations
// const sessionQueries = {
//   getAllSessions: async () => {
//     try {
//       // First test if there are any sessions at all
//       const basicTest = await query('SELECT COUNT(*) as count FROM StudySessions');
//       console.log('StudySessions count:', basicTest[0].count);
      
//       // Use LEFT JOIN instead of JOIN to be more forgiving if data is missing
//       return await query(`
//         SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
//         FROM StudySessions s
//         LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
//         LEFT JOIN Locations l ON s.LocationId = l.LocationId
//       `);
//     } catch (error) {
//       console.error('Error in getAllSessions:', error);
//       throw error;
//     }
//   },
  
//   getSessionById: async (id) => {
//     try {
//       return await query(`
//         SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
//         FROM StudySessions s
//         LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
//         LEFT JOIN Locations l ON s.LocationId = l.LocationId
//         WHERE s.SessionId = ?
//       `, [id]);
//     } catch (error) {
//       console.error(`Error in getSessionById for ${id}:`, error);
//       throw error;
//     }
//   },
  
//   getSessionsByCourse: async (courseTitle) => {
//     try {
//       return await query(`
//         SELECT s.*, c.CourseTitle, c.CourseName, l.LocationName, l.Latitude, l.Longitude 
//         FROM StudySessions s
//         LEFT JOIN Courses c ON s.CourseTitle = c.CourseTitle
//         LEFT JOIN Locations l ON s.LocationId = l.LocationId
//         WHERE c.CourseTitle = ?
//       `, [courseTitle]);
//     } catch (error) {
//       console.error(`Error in getSessionsByCourse for ${courseTitle}:`, error);
//       throw error;
//     }
//   },
  
//   createSession: async (sessionData) => {
//     try {
//       const { courseTitle, locationId, status, description } = sessionData;
//       console.log('Creating session with data:', { courseTitle, locationId, status, description });
      
//       // First check if course exists
//       const courseCheck = await query('SELECT COUNT(*) as count FROM Courses WHERE CourseTitle = ?', [courseTitle]);
//       if (courseCheck[0].count === 0) {
//         console.error(`Course ${courseTitle} does not exist`);
//         throw new Error(`Course ${courseTitle} does not exist in database`);
//       }
      
//       // Then check if location exists
//       const locationCheck = await query('SELECT COUNT(*) as count FROM Locations WHERE LocationId = ?', [locationId]);
//       if (locationCheck[0].count === 0) {
//         console.error(`Location ${locationId} does not exist`);
//         throw new Error(`Location ${locationId} does not exist in database`);
//       }
      
//       return await query(
//         'INSERT INTO StudySessions (CourseTitle, LocationId, Status, Description) VALUES (?, ?, ?, ?)',
//         [courseTitle, locationId, status, description]
//       );
//     } catch (error) {
//       console.error('Error in createSession:', error);
//       throw error;
//     }
//   },
  
//   // Get users participating in a session - using the direct SessionId in Users table
//   getSessionParticipants: async (sessionId) => {
//     try {
//       return await query('SELECT * FROM Users WHERE SessionId = ?', [sessionId]);
//     } catch (error) {
//       console.error(`Error in getSessionParticipants for session ${sessionId}:`, error);
//       throw error;
//     }
//   },
  
//   // Add a user to a session - updating their SessionId
//   addUserToSession: async (netId, sessionId) => {
//     try {
//       return await query('UPDATE Users SET SessionId = ? WHERE UserNetId = ?', [sessionId, netId]);
//     } catch (error) {
//       console.error(`Error in addUserToSession for user ${netId}, session ${sessionId}:`, error);
//       throw error;
//     }
//   }
// };

// // Initialize database connection
// testConnection();

// // Add a method to verify database tables exist
// async function verifyDatabaseSetup() {
//   try {
//     console.log('Verifying database tables...');
    
//     // Check each required table
//     const tables = ['Users', 'Courses', 'Locations', 'StudySessions'];
//     for (const table of tables) {
//       try {
//         const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
//         console.log(`Table ${table} exists with ${result[0].count} rows`);
//       } catch (error) {
//         console.error(`Error checking table ${table}:`, error);
//       }
//     }
    
//     console.log('Database verification complete');
//   } catch (error) {
//     console.error('Error verifying database setup:', error);
//   }
// }

// // Run verification
// setTimeout(verifyDatabaseSetup, 1000);

// module.exports = {
//   query,
//   userQueries,
//   courseQueries,
//   locationQueries,
//   sessionQueries,
//   testConnection,
//   verifyDatabaseSetup
// };