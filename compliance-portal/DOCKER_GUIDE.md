# Docker Quick Start Guide

## Prerequisites
1. Install Docker Desktop for Windows
2. Enable WSL 2 integration in Docker Desktop:
   - Open Docker Desktop Settings
   - Go to Resources → WSL Integration
   - Enable integration for your WSL distro
   - Click "Apply & Restart"

## Build and Run

### Option 1: Using docker-compose (Recommended)
```bash
cd /home/manojsingh/projects/compliance-skills/compliance-portal

# Build and start the application
docker-compose up --build

# Run in detached mode
docker-compose up -d --build

# Stop the application
docker-compose down

# View logs
docker-compose logs -f
```

### Option 2: Using Docker commands directly
```bash
cd /home/manojsingh/projects/compliance-skills/compliance-portal

# Build the image
docker build -t compliance-portal .

# Run the container
docker run -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  compliance-portal

# Run in detached mode
docker run -d -p 8080:8080 \
  --name compliance-portal \
  -v $(pwd)/data:/app/data \
  compliance-portal
```

## Access the Application
- Open browser to: http://localhost:8080

## Troubleshooting

### Docker not found in WSL2
If you see "command 'docker' could not be found":
1. Make sure Docker Desktop is running on Windows
2. Enable WSL integration (see Prerequisites above)
3. Restart your WSL terminal

### Build failures
- Make sure you're in the `compliance-portal` directory
- Use the root Dockerfile (not server/Dockerfile)
- Check that all dependencies are in package.json files

### Port already in use
If port 8080 is busy:
```bash
# Use a different port
docker run -p 3000:8080 compliance-portal

# Or stop existing containers
docker ps
docker stop <container-id>
```

## Database Options

### SQLite (Default)
Data persists in the mounted `./data` directory

### PostgreSQL (Production)
Uncomment the postgres service in docker-compose.yml and set:
- DATABASE_URL=postgresql://compliance:compliance@postgres:5432/compliance  
- USE_POSTGRES=true
