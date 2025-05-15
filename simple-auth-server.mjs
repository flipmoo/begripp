/**
 * Simple Authentication Server
 *
 * Dit is een eenvoudige Express server die de authenticatie routes registreert.
 */
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configuratie
const PORT = 3004;
const DB_PATH = './src/db/database.sqlite';
const JWT_SECRET = 'development-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Maak Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-bypass', 'cache-control', 'pragma', 'expires'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Database connectie
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      database: 'connected',
      uptime: process.uptime()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// Login endpoint
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Valideer input
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Username and password are required',
        code: 400
      }
    });
  }

  // Haal gebruiker op
  db.get(`
    SELECT * FROM users
    WHERE username = ? AND is_active = 1
  `, [username], async (err, user) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 500
        }
      });
    }

    // Controleer of gebruiker bestaat
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid username or password',
          code: 401
        }
      });
    }

    try {
      // Controleer wachtwoord
      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Invalid username or password',
            code: 401
          }
        });
      }

      // Haal rollen op
      db.all(`
        SELECT r.*
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
      `, [user.id], (err, roles) => {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({
            success: false,
            error: {
              message: 'Internal server error',
              code: 500
            }
          });
        }

        // Genereer JWT token
        const token = jwt.sign(
          {
            userId: user.id,
            username: user.username,
            isAdmin: user.is_admin
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        // Genereer refresh token
        const refreshToken = jwt.sign(
          {
            userId: user.id,
            tokenType: 'refresh'
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Update last login
        db.run(`
          UPDATE users
          SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [user.id]);

        // Stuur response
        res.json({
          success: true,
          data: {
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              is_active: user.is_active === 1,
              is_admin: user.is_admin === 1,
              roles: roles
            },
            token,
            refreshToken
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 500
        }
      });
    }
  });
});

// Me endpoint
app.get('/api/v1/auth/me', (req, res) => {
  // Haal token op uit Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'No token provided',
        code: 401
      }
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifieer token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Haal gebruiker op
    db.get(`SELECT * FROM users WHERE id = ?`, [decoded.userId], (err, user) => {
      if (err) {
        console.error('Database error:', err.message);
        return res.status(500).json({
          success: false,
          error: {
            message: 'Internal server error',
            code: 500
          }
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'User not found',
            code: 404
          }
        });
      }

      // Haal rollen op
      db.all(`
        SELECT r.*
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
      `, [user.id], (err, roles) => {
        if (err) {
          console.error('Database error:', err.message);
          return res.status(500).json({
            success: false,
            error: {
              message: 'Internal server error',
              code: 500
            }
          });
        }

        // Stuur response
        res.json({
          success: true,
          data: {
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            is_active: user.is_active === 1,
            is_admin: user.is_admin === 1,
            roles: roles
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 401
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Simple authentication server listening on port ${PORT}`);
  console.log(`Authentication is disabled globally`);
});
