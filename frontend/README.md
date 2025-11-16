# Frontend Development

## Local Development (Fast)

For fast frontend development with hot module replacement:

```bash
cd frontend
npm install
npm run dev
```

This will start Vite dev server on http://localhost:5173
The frontend will make API calls to http://localhost:3000 (make sure backend is running in Docker)

## Building for Production

To build the frontend for production:

```bash
cd frontend
npm run build
```

This creates optimized files in `frontend/dist/`

## Docker Integration

The Dockerfile automatically builds the frontend and copies it to the `public/` directory.
Node.js serves the built files at the root path.

```bash
# Build and start everything
docker-compose up --build

# Access the app
# http://localhost:3000
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── TemplateGallery.jsx    # Query template selection
│   │   ├── StockSelector.jsx      # Stock symbol picker
│   │   ├── DateRangePicker.jsx    # Date range selection
│   │   ├── QueryResults.jsx       # Result display with tabs
│   │   ├── ChartDisplay.jsx       # Recharts visualizations
│   │   └── AdvancedEditor.jsx     # Custom JSONata editor
│   ├── App.jsx                    # Main application component
│   ├── main.jsx                   # React entry point
│   └── index.css                  # Tailwind CSS
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Tech Stack

- **React 18**: UI framework
- **Vite**: Build tool (dev server + bundler)
- **Tailwind CSS**: Utility-first styling
- **Recharts**: Charting library
- **react-json-view**: JSON viewer with syntax highlighting
