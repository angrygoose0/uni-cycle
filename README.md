# Laundry Machine Timer

A web application for managing laundry machine timers in shared facilities like apartments, dorms, or laundromats. Users can set timers for washing machines and dryers, and receive real-time status updates when machines become available.

## Features

- 🏠 **Machine Management**: Track multiple washing machines and dryers
- ⏰ **Timer System**: Set custom timers for each machine (up to 5 hours)
- 📱 **Real-time Updates**: Live status updates via Server-Sent Events (SSE)
- 🔄 **Automatic Cleanup**: Expired timers are automatically processed
- 🌐 **Web Interface**: Clean, responsive web UI for easy interaction
- 📊 **SQLite Database**: Lightweight, file-based data storage
- 🛡️ **Graceful Shutdown**: Proper cleanup and resource management

## Prerequisites

Before running the application, make sure you have:

- **Node.js** (version 18.0.0 or higher)
- **npm** (comes with Node.js)

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository (if applicable)
# git clone <repository-url>
# cd laundry-machine-timer

# Install dependencies
npm install
```

### 2. Set up the Database

```bash
# Initialize the database with schema and sample data
npm run db:setup
```

This command will:
- Create the SQLite database file at `./data/laundry.db`
- Set up the database schema (machines table with indexes)
- Insert sample machines (washers and dryers)

### 3. Start the Application

For development with auto-reload:
```bash
npm run dev
```

Or build and run in production mode:
```bash
npm run build
npm start
```

### 4. Access the Application

Once started, the application will be available at:

- **Main Application**: http://localhost:3000/
- **Health Check**: http://localhost:3000/health
- **API Documentation**: See [API Endpoints](#api-endpoints) below

## Configuration

The application can be configured using environment variables. Copy `.env.example` to `.env` and modify as needed:

```bash
cp .env.example .env
```

### Available Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `NODE_ENV` | `development` | Environment (development/production/test) |
| `DATABASE_PATH` | `./data/laundry.db` | SQLite database file path |
| `DATABASE_TIMEOUT_MS` | `30000` | Database connection timeout |
| `TIMER_CHECK_INTERVAL_MS` | `30000` | How often to check for expired timers |
| `MAX_TIMER_DURATION_MINUTES` | `120` | Maximum timer duration (2 hours) |
| `LOG_LEVEL` | `info` | Logging level (error/warn/info/debug) |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Graceful shutdown timeout |
| `CORS_ORIGIN` | `*` | CORS allowed origins |

### Example Production Configuration

```env
NODE_ENV=production
PORT=8080
HOST=0.0.0.0
LOG_LEVEL=warn
DATABASE_PATH=/var/lib/laundry-timer/laundry.db
CORS_ORIGIN=https://yourdomain.com
```

## Database Management

### Available Database Commands

```bash
# Set up database (create schema + seed data)
npm run db:setup

# Run migrations only
npm run db:migrate

# Reset database (drop and recreate)
npm run db:reset

# Seed sample data
npm run db:seed

# Re-seed (clear and add fresh sample data)
npm run db:reseed

# Show database statistics
npm run db:stats
```

### Database Schema

The application uses a single `machines` table:

```sql
CREATE TABLE machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('washer', 'dryer')),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in-use')),
    timer_end_time INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

## API Endpoints

### Machine Management

- **GET** `/api/machines` - List all machines with current status
- **POST** `/api/machines/:id/timer` - Set timer for a specific machine

### Real-time Updates

- **GET** `/api/machines/status` - Server-Sent Events stream for real-time updates
- **GET** `/api/machines/status/polling` - Polling fallback for status updates

### Health Check

- **GET** `/health` - Application health status

### Example API Usage

```bash
# Get all machines
curl http://localhost:3000/api/machines

# Set a 60-minute timer for machine ID 1
curl -X POST http://localhost:3000/api/machines/1/timer \
  -H "Content-Type: application/json" \
  -d '{"durationMinutes": 60}'

# Check application health
curl http://localhost:3000/health
```

## Development

### Available Scripts

```bash
# Development with auto-reload
npm run dev

# Build TypeScript
npm run build

# Build frontend assets
npm run build:frontend

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Clean build artifacts
npm clean
```

### Project Structure

```
src/
├── __tests__/          # Test files
├── app.ts             # Main application class
├── index.ts           # Application entry point
├── config/            # Configuration management
├── controllers/       # HTTP request handlers
├── database/          # Database connection and migrations
├── frontend/          # Frontend TypeScript files
├── models/            # Data models
├── public/            # Static web assets
├── services/          # Business logic services
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=app-startup.test.ts

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode during development
npm run test:watch
```

## Deployment

### Production Build

```bash
# Install dependencies
npm ci --only=production

# Build the application
npm run build

# Set up database
npm run db:setup

# Start the application
npm start
```

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure appropriate `PORT` and `HOST`
3. Set `DATABASE_PATH` to a persistent location
4. Configure `CORS_ORIGIN` for your domain
5. Set `LOG_LEVEL=warn` or `LOG_LEVEL=error`

### Process Management

For production deployment, consider using a process manager like PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start the application with PM2
pm2 start dist/index.js --name laundry-timer

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure the `data/` directory exists and is writable
   - Check `DATABASE_PATH` configuration
   - Run `npm run db:setup` to initialize the database

2. **Port Already in Use**
   - Change the `PORT` environment variable
   - Kill existing processes: `lsof -ti:3000 | xargs kill`

3. **Permission Errors**
   - Ensure the application has write permissions to the database directory
   - Check file ownership and permissions

4. **Build Errors**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Clean build artifacts: `npm run clean && npm run build`

### Logs and Debugging

- Set `LOG_LEVEL=debug` for detailed logging
- Check application logs for error messages
- Use the health check endpoint to verify application status
- Monitor database file size and permissions

### Getting Help

If you encounter issues:

1. Check the application logs for error messages
2. Verify your environment configuration
3. Ensure all prerequisites are installed
4. Try running the database setup commands again
5. Check that no other applications are using the same port

## License

MIT License - see LICENSE file for details.