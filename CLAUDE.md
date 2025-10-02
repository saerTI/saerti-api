# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SAER Backend is a Node.js/Express REST API for construction project management with detailed financial tracking, cost center analysis, and multidimensional data analysis. Uses ES modules (.mjs) and MySQL database.

## Development Commands

### Essential Commands
- `npm run dev` - Start development server with nodemon (runs on port 3000)
- `npm start` - Start production server
- `npm run setup` - Initialize database and create tables automatically
- `npm run setup_db:force` - Force reset database (⚠️ DESTRUCTIVE - deletes existing data)

### Setup Commands
- `node scripts/setup.mjs` - Create database schema
- `node scripts/seedAdmin.mjs` - Create default admin user (felipeslzar@gmail.com / 1234)

### Database Configuration
- Backend expects MySQL connection on localhost:3306
- Database name: configurable via DB_NAME (default: constructflow)
- Automatic database creation and table setup via scripts

## Architecture Overview

### Core Structure
- **ES Module Architecture** - Uses .mjs files throughout for ES module support
- **Express.js REST API** with middleware-based architecture
- **MySQL with connection pooling** via mysql2/promise
- **JWT Authentication** with role-based authorization (admin/manager/user)
- **Layered Architecture**: Routes → Controllers → Models → Database
- **Cost Center (CC) Domain** - Specialized modules for cost center management

### Key Patterns
- All database operations use connection pooling from `src/config/database.mjs`
- Authentication middleware validates JWT tokens and attaches user data to requests
- Controllers follow consistent error handling and JSON response patterns
- Models encapsulate database queries and business logic
- Route files organize endpoints by domain (auth, users, projects, CC modules)

### Authentication & Authorization
- JWT tokens stored in Authorization header as `Bearer <token>`
- Middleware: `authenticate` (verify token), `authorize` (check roles), `authorizeOwnerOrAdmin`
- User roles: admin (full access), manager (limited admin), user (read-only)
- Password hashing with bcrypt, configurable JWT expiration

### Database Architecture
- Connection pool configuration in `src/config/database.mjs`
- Automatic connection testing and error reporting with MySQL-specific troubleshooting
- Database setup scripts handle schema creation and initial data seeding
- Model files use prepared statements for security

### API Structure
- RESTful endpoints with consistent `/api` prefix
- Cost Center modules under `/api/CC/*` namespace (consolidada, multidimensional, etc.)
- Error handling middleware provides structured JSON error responses
- Request logging middleware for debugging and monitoring

### AI Integration (Anthropic Claude)
- Claude API integration for budget analysis and PDF processing
- Configurable models and token limits in config
- PDF analysis with OCR support (Tesseract.js, pdf-parse, Sharp for image processing)
- Budget suggestion system with cost optimization algorithms

### Key Directories
- `src/controllers/` - Request handlers organized by domain
- `src/controllers/CC/` - Cost Center specific controllers
- `src/models/` - Database interaction layer
- `src/routes/` - API route definitions
- `src/middleware/` - Custom middleware (auth, error handling, file upload)
- `src/services/` - Business logic and external API integrations
- `src/config/` - Configuration management and database setup
- `scripts/` - Database setup and maintenance scripts

### Configuration Management
- Environment-based configuration in `src/config/config.mjs`
- Database connection parameters with validation and error reporting
- Anthropic API configuration with model validation and rate limiting
- Production vs development environment handling

### Development Notes
- Uses ES modules exclusively (.mjs extension)
- MySQL connection pool with automatic reconnection handling
- Comprehensive error logging with context-specific troubleshooting suggestions
- CORS enabled for frontend integration
- File upload support with Multer for PDF processing
- Built-in health check endpoint at `/api/health`