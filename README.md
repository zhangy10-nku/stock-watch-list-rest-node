# Stock Watchlist REST API

A Node.js REST API for managing a stock watchlist, built with Express and SQLite, running entirely in Docker containers.

## 🚀 Features

- ✅ Full CRUD operations for stock watchlist
- ✅ SQLite database for data persistence
- ✅ Dockerized development environment
- ✅ Live code reloading with nodemon
- ✅ VS Code debugging support
- ✅ No local Node.js or SQLite installation required

## 📋 Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Visual Studio Code](https://code.visualstudio.com/)
- [Remote - Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

## 🏁 Getting Started

### Option 1: Using Dev Containers (Recommended)

1. **Install the Remote - Containers extension** in VS Code
2. **Open this project** in VS Code
3. **Reopen in Container**:
   - Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Remote-Containers: Reopen in Container"
   - Select the command and wait for the container to build

VS Code will automatically:
- Build the Docker container
- Install all dependencies
- Set up the development environment
- Forward ports 3000 (app) and 9229 (debugger)

### Option 2: Using Docker Compose

```bash
# Build and start the container
docker-compose up --build

# The API will be available at http://localhost:3000
```

## 🐛 Debugging

1. Start the dev container or run `docker-compose up`
2. In VS Code, go to the **Run and Debug** panel (Cmd+Shift+D)
3. Select **"Docker: Attach to Node"**
4. Press F5 or click the green play button
5. Set breakpoints in your code and they'll be hit!

## 📡 API Endpoints

### Get all stocks
```bash
GET http://localhost:3000/api/stocks
```

### Get a single stock
```bash
GET http://localhost:3000/api/stocks/:id
```

### Create a new stock
```bash
POST http://localhost:3000/api/stocks
Content-Type: application/json

{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "quantity": 10,
  "purchase_price": 150.25,
  "notes": "Tech stock"
}
```

### Update a stock
```bash
PUT http://localhost:3000/api/stocks/:id
Content-Type: application/json

{
  "quantity": 15,
  "purchase_price": 155.50
}
```

### Delete a stock
```bash
DELETE http://localhost:3000/api/stocks/:id
```

## 🧪 Testing the API

Using curl:

```bash
# Health check
curl http://localhost:3000/health

# Get all stocks
curl http://localhost:3000/api/stocks

# Add a stock
curl -X POST http://localhost:3000/api/stocks \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "quantity": 10,
    "purchase_price": 150.25
  }'

# Update a stock
curl -X PUT http://localhost:3000/api/stocks/1 \
  -H "Content-Type: application/json" \
  -d '{"quantity": 15}'

# Delete a stock
curl -X DELETE http://localhost:3000/api/stocks/1
```

## 📁 Project Structure

```
stock-watch-list-rest-node/
├── .devcontainer/
│   └── devcontainer.json      # Dev container configuration
├── .vscode/
│   └── launch.json            # VS Code debugger configuration
├── src/
│   ├── index.js               # Application entry point
│   ├── database.js            # SQLite database setup
│   └── routes/
│       └── stocks.js          # Stock routes and handlers
├── data/                      # SQLite database (auto-created)
├── Dockerfile                 # Docker image definition
├── docker-compose.yml         # Docker Compose configuration
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## 🔄 Live Reloading

The application uses **nodemon** for automatic reloading. Any changes you make to files in the `src/` directory will automatically restart the server. Just save your file and watch the terminal!

## 💾 Database Persistence

The SQLite database is stored in the `./data` directory, which is:
- Mounted as a volume in Docker
- Persisted between container restarts
- Excluded from git (via `.gitignore`)

## 🛠️ Development Workflow

1. **Make code changes** in VS Code
2. **Save the file** - nodemon will automatically restart the server
3. **Set breakpoints** and debug using F5
4. **Test your API** using curl, Postman, or your browser

## 📦 Docker Commands

```bash
# Build the container
docker-compose build

# Start the container
docker-compose up

# Start in detached mode
docker-compose up -d

# Stop the container
docker-compose down

# View logs
docker-compose logs -f

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

## 🔍 Troubleshooting

### Port already in use
If port 3000 or 9229 is already in use, modify the ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"   # Use port 3001 on your host
  - "9230:9229"   # Use port 9230 for debugging
```

### Container won't start
```bash
# Check Docker logs
docker-compose logs

# Rebuild the container
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Database issues
Delete the `data/` directory and restart the container to reset the database:
```bash
rm -rf data/
docker-compose restart
```

## 📝 License

ISC

## 🤝 Contributing

Feel free to submit issues and pull requests!
